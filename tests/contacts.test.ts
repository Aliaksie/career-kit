import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { disclose, loadProfile, validateProfile } from '../src/application/profile.js';
import { build, explain } from '../src/application/build.js';
import { tailor } from '../src/application/tailor.js';
import { compose } from '../src/renderers/documents.js';
import type { LanguageModel } from '../src/llm/provider.js';
const contact = { type: 'email', value: 'alex@example.com', visibility: 'public', disclosure: { cv: true } };
async function example(contacts: unknown[]) {
  const p = await loadProfile('examples/software-engineer/profile-v2.yaml');
  return validateProfile({ ...p, person: { ...p.person, contacts } });
}
it('filters contacts before composition with independent deny-by-default permissions', async () => {
  const p = await example([contact, { ...contact, value: 'withheld@example.com', disclosure: undefined }, { ...contact, value: 'private@example.com', visibility: 'private' }, { type: 'phone', value: '+12025550123', visibility: 'public', disclosure: { cv: true } }]);
  const cv = disclose(p, 'cv');
  expect(cv.version === 2 && cv.person.contacts?.map(c => c.id)).toEqual(['contact-1', 'contact-4']);
  const rendered = compose(cv);
  expect(rendered.html).toContain('mailto:alex%40example.com');
  expect(rendered.html).toContain('tel:+12025550123');
  expect(rendered.claims).toContainEqual({ text: 'alex@example.com — mailto:alex%40example.com', sources: ['contact:contact-1', `person:${p.person.id}`] });
  expect(JSON.stringify(rendered)).not.toMatch(/withheld@example|private@example/);
  const github = disclose(p, 'github');
  expect(github.version === 2 && github.person.contacts).toEqual([]);
  expect(JSON.stringify(compose(github, true))).not.toContain('alex@example.com');
  p.person.disclosure.cv = false;
  expect(() => disclose(p, 'cv')).toThrow('Person is not disclosed');
});
it('assigns pre-filter IDs and rejects global collisions', async () => {
  const p = await example([{ ...contact, visibility: 'private' }, contact]);
  const cv = disclose(p, 'cv');
  expect(cv.version === 2 && cv.person.contacts?.[0].id).toBe('contact-2');
  await expect(example([{ ...contact, id: p.person.id }])).rejects.toThrow('Duplicate entity ID');
  await expect(example([contact, { ...contact, id: 'contact-1' }])).rejects.toThrow('Duplicate entity ID');
});
it('rejects unsafe contact values without echoing them, including private values', async () => {
  for (const [type, value] of [
    ['email', 'secret@example.com?subject=hidden'], ['email', 'secret@example.com\r\nBcc:other@example.com'],
    ['email', '<script>@example.com'], ['email', '.secret@example.com'], ['email', 'secret..value@example.com'], ['email', 'secret%0A@example.com'],
    ['phone', '+12025550123;ext=secret'], ['phone', '12025550123'],
    ['url', 'javascript:secret()'], ['url', 'https://user:secret@example.com'],
    ['url', 'https://example.com/?secret'], ['url', 'https://example.com/#secret'],
    ['url', 'https://example.com/\nsecret'],
  ]) {
    let error: unknown;
    try { await example([{ ...contact, visibility: 'private', type, value }]); } catch (caught) { error = caught; }
    expect(error).toBeDefined();
    expect(String(error)).not.toContain(value);
  }
  const doc = compose(disclose(await example([{ ...contact, type: 'url', value: 'https://example.com/<script>' }]), 'cv'));
  expect(doc.html).not.toContain('<script>');
  expect(doc.html).toContain('%3Cscript%3E');
});
it('keeps contacts out of providers and GitHub artifacts but retains CV provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-contacts-'));
  try {
    const p = await example([contact, { ...contact, value: 'private@example.com', visibility: 'private' }]);
    await build(p, 'generic', dir, false);
    expect(await explain(join(dir, 'cv.md'))).toContain('contact:contact-1');
    for (const name of ['github-readme.md', 'github-readme.md.claims.json']) expect(await readFile(join(dir, name), 'utf8')).not.toContain('alex@example');
    let calls = 0;
    const model: LanguageModel = {
      identity: { provider: 'fixture', model: 'test' },
      async generate(request) {
        calls++;
        expect(request.input).toEqual({ achievements: [{ id: p.achievements[0].id, statement: p.achievements[0].statement }] });
        return request.schema.parse({ achievements: [{ id: p.achievements[0].id, order: 'context-first' }] });
      },
    };
    await tailor(p, 'TypeScript required', dir, { pdf: false, model });
    expect(calls).toBe(1);
    expect(await explain(join(dir, 'cv.html'))).toContain('contact:contact-1');
    expect(await readFile(join(dir, 'cv.md.claims.json'), 'utf8')).not.toContain('private@example');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it('uses short social-link labels while retaining destinations and contact provenance', async () => {
  const p = await example([
    { ...contact, type: 'url', value: 'https://www.linkedin.com/in/alex-example', disclosure: { cv: true, github: true } },
    { ...contact, type: 'url', value: 'https://github.com/example', disclosure: { cv: true, github: true } },
    { ...contact, type: 'url', value: 'https://example.com/portfolio', disclosure: { cv: true } },
  ]);
  const doc = compose(disclose(p, 'cv'));
  expect(doc.markdown).toContain('[LinkedIn](<https://www.linkedin.com/in/alex-example>)');
  expect(doc.markdown).toContain('[GitHub](<https://github.com/example>)');
  expect(doc.html).toContain('<a href="https://github.com/example">GitHub</a>');
  expect(doc.claims).toContainEqual({ text: 'LinkedIn — https://www.linkedin.com/in/alex-example', sources: ['contact:contact-1', `person:${p.person.id}`] });
  expect(doc.markdown).toContain('[https://example');
});
