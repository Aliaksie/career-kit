import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadProfile } from '../src/application/profile.js';
import { build, explain } from '../src/application/build.js';
import { tailor } from '../src/application/tailor.js';
import { polish } from '../src/application/polish.js';
import { compose } from '../src/renderers/documents.js';
import type { LanguageModel, GenerationRequest } from '../src/llm/provider.js';

const example = () => loadProfile('examples/software-engineer/profile.yaml');
function fake(output: unknown, inspect: (input: unknown) => void = () => {}): LanguageModel {
  return { identity: { provider: 'fixture', model: 'deterministic' },
    async generate<T>(request: GenerationRequest<T>): Promise<T> { inspect(request.input); return request.schema.parse(output); },
  };
}
it('keeps qualifiers and every complete source clause through extractive polishing', async () => {
  const p = await example();
  p.achievements[0].statement = { problem: 'Prototype only.', action: 'Co-designed with the team.', outcome: 'No measured production improvement.' };
  const baseline = compose(p);
  const orders = await polish(p, fake({ achievements: [{ id: p.achievements[0].id, order: 'action-first' }] }));
  const candidate = compose(p, false, orders);
  for (const clause of Object.values(p.achievements[0].statement)) {
    expect(baseline.claims.some(c => c.text.includes(clause))).toBe(true);
    expect(candidate.claims.some(c => c.text.includes(clause))).toBe(true);
  }
  expect(candidate.claims.find(c => c.sources.includes(`achievement:${p.achievements[0].id}`))?.text).toBe('Co-designed with the team. Prototype only. No measured production improvement.');
});
it('sends only selected disclosed statements and rejects invented text or substituted IDs', async () => {
  const p = await example();
  p.person.summary = 'CONTACT_MARKER';
  p.achievements.push({ ...p.achievements[0], id: 'secret', visibility: 'private', statement: { problem: 'SECRET_MARKER', action: 'SECRET_MARKER', outcome: 'SECRET_MARKER' } });
  const inspect = vi.fn((input: unknown) => {
    expect(JSON.stringify(input)).not.toContain('SECRET_MARKER');
    expect(JSON.stringify(input)).not.toContain('CONTACT_MARKER');
    expect(input).toEqual({ achievements: [{ id: 'reliable-processing', statement: p.achievements[0].statement }] });
  });
  await polish(p, fake({ achievements: [{ id: 'reliable-processing', order: 'context-first' }] }, inspect));
  expect(inspect).toHaveBeenCalledOnce();
  for (const output of [
    { achievements: [{ id: 'reliable-processing', order: 'action-first', text: 'Invented 90% improvement' }] },
    { achievements: [{ id: 'secret', order: 'action-first' }] },
    { achievements: [] },
    { achievements: [{ id: 'reliable-processing', order: 'action-first' }, { id: 'reliable-processing', order: 'action-first' }] },
  ]) await expect(polish(p, fake(output))).rejects.toThrow();
});
it('tailors CV-only output, reports gaps, retains provenance and removes stale artifacts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-tailor-'));
  try {
    const p = await example();
    await build(p, 'generic', dir, false);
    await writeFile(join(dir, 'cv.pdf'), 'stale');
    await tailor(p, '- TypeScript required\n- Rust preferred\n- Proficiency in an internal DSL', dir, { pdf: false });
    const report = JSON.parse(await readFile(join(dir, 'matching.json'), 'utf8'));
    expect(report.coverage.find((c: {requirement: { label: string }}) => c.requirement.label === 'rust').matched).toEqual([]);
    const explained = await explain(join(dir, 'cv.md'));
    expect(explained).toContain('Requirement: rust (preferred)\nMatched evidence: none');
    expect(explained).toContain('Unparsed job lines');
    await expect(readFile(join(dir, 'github-readme.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(dir, 'cv.pdf'))).rejects.toMatchObject({ code: 'ENOENT' });
    const first = await readFile(join(dir, 'cv.md'), 'utf8');
    await tailor(p, '- TypeScript required\n- Rust preferred\n- Proficiency in an internal DSL', dir, { pdf: false });
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toBe(first);
    await build(p, 'generic', dir, false);
    await expect(readFile(join(dir, 'matching.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('leaves existing files unchanged when a model response fails validation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-reject-'));
  try {
    await writeFile(join(dir, 'cv.md'), 'previous');
    await expect(tailor(await example(), 'TypeScript required', dir, { pdf: false, model: fake({ achievements: [] }) })).rejects.toThrow('omitted');
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toBe('previous');
    await expect(readFile(join(dir, 'matching.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('does not invoke a model for empty selection or beyond the call budget', async () => {
  const p = await example();
  const model = fake({ achievements: [] });
  const generate = vi.spyOn(model, 'generate');
  await polish({ ...p, achievements: [] }, model);
  expect(generate).not.toHaveBeenCalled();
  const tooMany = { ...p, achievements: Array.from({ length: 51 }, (_, i) => ({ ...p.achievements[0], id: `evidence-${i}` })) };
  await expect(polish(tooMany, model)).rejects.toThrow('at most 50');
  expect(generate).not.toHaveBeenCalled();
});
