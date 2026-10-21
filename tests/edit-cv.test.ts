import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { loadProfile } from '../src/application/profile.js';
import { editCV } from '../src/application/edit-cv.js';
import { build } from '../src/application/build.js';
import { tailor } from '../src/application/tailor.js';
import { verifyBundle } from '../src/application/bundle.js';
import { loadPrompt, parsePrompt } from '../src/llm/prompts.js';
import type { LanguageModel, GenerationRequest } from '../src/llm/provider.js';
import type { Profile } from '../src/schema/profile.js';

async function example() {
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  p.achievements[0].statement = {
    problem: 'The service had slow TypeScript processing.',
    action: 'Co-designed with the team a TypeScript worker.',
    outcome: 'Prototype only. Reduced processing time by approximately 20%.',
  };
  return p;
}
function fixture(p: Profile, mutate: (a: { id: string; statement: Profile['achievements'][number]['statement']; order: string }[]) => void = () => {}, inspect: (r: GenerationRequest<unknown>) => void = () => {}): LanguageModel {
  return { identity: { provider: 'fixture', model: 'offline' }, async generate<T>(request: GenerationRequest<T>): Promise<T> {
    inspect(request);
    const achievements = p.achievements.map(a => ({ id: a.id, statement: { ...a.statement }, order: 'action-first' }));
    mutate(achievements);
    return { achievements } as T; // Bypass provider validation to exercise the domain boundary.
  } };
}
it('loads structured prompt sections, identity and settings; rejects malformed documents', async () => {
  for (const name of ['polish-cv', 'tailor-cv', 'clause-order'] as const) {
    const p = await loadPrompt(name);
    expect(p.identity).toBe(`${name}-v1`);
    expect(p.system).not.toContain('parameters:');
    expect(p.user).not.toBe('');
    expect(p.parameters.maxTokens).toBeGreaterThan(0);
  }
  expect(() => parsePrompt('system: edit')).toThrow();
  expect(() => parsePrompt('---\nname: invalid\n---\nsystem:\n\nuser:\nx')).toThrow();
});
it('edits wording without mutating source data and uses distinct general/job prompts', async () => {
  const p = await example();
  const source = structuredClone(p);
  const seen: GenerationRequest<unknown>[] = [];
  const model = fixture(p, a => { a[0].statement.problem = 'TypeScript processing in the service was slow.'; }, r => seen.push(r));
  const general = await editCV(p, model);
  const job = await editCV(p, model, [{ id: 'ts', label: 'TypeScript', terms: ['typescript'], importance: 'required' }]);
  expect(p).toEqual(source);
  expect(general.profile.achievements[0].statement.problem).toBe('TypeScript processing in the service was slow.');
  expect(general.metadata?.promptVersion).toBe('polish-cv-v1');
  expect(job.metadata?.promptVersion).toBe('tailor-cv-v1');
  expect(seen[0].input).not.toHaveProperty('requirements');
  expect(seen[1].input).toHaveProperty('requirements');
  expect(seen[0].parameters).toEqual({ maxTokens: 8192, temperature: 0 });
  expect(seen[1].instructions).toContain('Requirements describe the employer');
});
it('sends only disclosed achievements and allowlisted job requirements', async () => {
  const p = await example();
  p.person.summary = 'CONTACT_SECRET';
  p.achievements.push({ ...p.achievements[0], id: 'private', visibility: 'private', statement: { problem: 'PRIVATE_SECRET', action: 'PRIVATE_SECRET', outcome: 'PRIVATE_SECRET' } });
  const publicProfile = { ...p, achievements: [p.achievements[0]] };
  const inspect = vi.fn((request: GenerationRequest<unknown>) => {
    const input = JSON.stringify(request.input);
    expect(input).not.toMatch(/CONTACT_SECRET|PRIVATE_SECRET|organization|contacts/);
    expect(Object.keys(request.input as object)).toEqual(['achievements', 'requirements']);
  });
  await editCV(p, fixture(publicProfile, undefined, inspect), []);
  expect(inspect).toHaveBeenCalledOnce();
});
it('rejects changed metrics, lost qualifiers/attribution/technology, imported requirements and malformed IDs', async () => {
  const p = await example();
  const corruptions: Parameters<typeof fixture>[1][] = [
    a => { a[0].statement.outcome = 'Prototype only. Reduced processing time by approximately 90%.'; },
    a => { a[0].statement.outcome = 'Reduced processing time by 20%.'; },
    a => { a[0].statement.action = 'Designed a worker.'; },
    a => { a[0].statement.problem = 'The service had slow processing.'; },
    a => { a[0].statement.action += ' Used Rust.'; },
    a => { a[0].statement.action += ' https://example.test'; },
    a => { a[0].id = 'invented'; },
    a => { a.push(a[0]); },
    a => { a.pop(); },
    a => { Object.assign(a[0], { invented: true }); },
  ];
  for (const mutate of corruptions) await expect(editCV(p, fixture(p, mutate), [{ id: 'rust', label: 'Rust', terms: ['Rust'], importance: 'required' }])).rejects.toThrow();
});
it('bounds input before invoking even a custom model and skips empty selections', async () => {
  const p = await example();
  const model = fixture(p);
  const generate = vi.spyOn(model, 'generate');
  await editCV({ ...p, achievements: [] }, model);
  await expect(editCV({ ...p, achievements: Array.from({ length: 51 }, (_, i) => ({ ...p.achievements[0], id: `a-${i}` })) }, model)).rejects.toThrow('at most 50');
  p.achievements[0].statement.action = 'x'.repeat(4001);
  await expect(editCV(p, model)).rejects.toThrow();
  expect(generate).not.toHaveBeenCalled();
});
it('rejects request byte overflow, malformed requirements, controls and reordered IDs before accepting edits', async () => {
  const p = await example();
  const model = fixture(p);
  const generate = vi.spyOn(model, 'generate');
  const large = { ...p, achievements: Array.from({ length: 6 }, (_, i) => ({ ...p.achievements[0], id: `a-${i}`, statement: { problem: 'x'.repeat(4000), action: 'x'.repeat(4000), outcome: 'x'.repeat(4000) } })) };
  await expect(editCV(large, model)).rejects.toThrow('64000');
  await expect(editCV(p, model, [{ id: 'bad', label: 'x'.repeat(501), terms: ['x'], importance: 'required' }])).rejects.toThrow();
  p.achievements[0].statement.problem = 'Hidden\u0000control';
  await expect(editCV(p, model)).rejects.toThrow();
  expect(generate).not.toHaveBeenCalled();
  const two = await example();
  two.achievements.push({ ...two.achievements[0], id: 'second' });
  await expect(editCV(two, fixture(two, a => { a.reverse(); }))).rejects.toThrow('ID order');
  await expect(editCV(two, fixture(two, a => { a[1].id = a[0].id; }))).rejects.toThrow('ID order');
});
it('applies job-aware wording edits while preserving deterministic coverage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-job-edit-'));
  try {
    const p = await example();
    await tailor(p, 'TypeScript required', dir, { pdf: false });
    const before = JSON.parse(await readFile(join(dir, 'matching.json'), 'utf8'));
    await tailor(p, 'TypeScript required', dir, { pdf: false, model: fixture(p, a => {
      a[0].statement.problem = 'TypeScript processing in the service was slow.';
    }) });
    await verifyBundle(dir);
    const after = JSON.parse(await readFile(join(dir, 'matching.json'), 'utf8'));
    expect(after.coverage).toEqual(before.coverage);
    expect(after.polishing).toMatchObject({ promptVersion: 'tailor-cv-v1', reviewRequired: true });
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toContain('TypeScript processing in the service was slow');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('records general editing provenance, keeps GitHub unchanged and falls back for both modes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-edit-'));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const p = await example();
    await build(p, 'generic', dir, false);
    const baseline = await readFile(join(dir, 'cv.md'), 'utf8');
    const github = await readFile(join(dir, 'github-readme.md'), 'utf8');
    await build(p, 'generic', dir, false, undefined, fixture(p, a => { a[0].statement.problem = 'TypeScript processing in the service was slow.'; }));
    await verifyBundle(dir);
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).not.toBe(baseline);
    expect(await readFile(join(dir, 'github-readme.md'), 'utf8')).toBe(github);
    expect(JSON.parse(await readFile(join(dir, 'cv.md.claims.json'), 'utf8')).polishing).toMatchObject({ promptVersion: 'polish-cv-v1', reviewRequired: true });
    expect(JSON.parse(await readFile(join(dir, 'github-readme.md.claims.json'), 'utf8'))).not.toHaveProperty('polishing');
    await build(p, 'generic', dir, false, undefined, fixture(p, a => { a[0].statement.outcome = 'Invented 99%.'; }));
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toBe(baseline);
    expect(JSON.parse(await readFile(join(dir, 'cv.md.claims.json'), 'utf8'))).not.toHaveProperty('polishing');
    await tailor(p, 'TypeScript required', dir, { pdf: false });
    const tailored = await readFile(join(dir, 'cv.md'), 'utf8');
    await tailor(p, 'TypeScript required', dir, { pdf: false, model: fixture(p, a => { a[0].statement.outcome = 'Invented 99%.'; }) });
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toBe(tailored);
    expect(warn).toHaveBeenCalledTimes(2);
  } finally { warn.mockRestore(); await rm(dir, { recursive: true, force: true }); }
});
