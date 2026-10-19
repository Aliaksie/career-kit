import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { loadProfile } from '../src/application/profile.js';
import { build, explain } from '../src/application/build.js';
import { compose } from '../src/renderers/documents.js';

it('escapes untrusted profile text in both renderers', async () => {
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  p.person.name = '<script>alert(1)</script> [click](https://example.com)';
  const doc = compose(p);
  expect(doc.html).not.toContain('<script>');
  expect(doc.html).toContain('&lt;script&gt;');
  expect(doc.markdown).not.toContain('[click](');
});
it('builds deterministic artifacts, filters private evidence and verifies provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-kit-'));
  try {
    const p = await loadProfile('examples/software-engineer/profile.yaml');
    p.achievements.push({ ...p.achievements[0], id: 'secret', visibility: 'private', statement: { problem: 'SECRET', action: 'SECRET', outcome: 'SECRET' } });
    p.achievements[0].disclosure.github = false;
    await writeFile(join(dir, 'cv.pdf'), 'obsolete private material');
    await writeFile(join(dir, 'cv.pdf.claims.json'), '{}');
    await build(p, 'generic', dir, false);
    await expect(readFile(join(dir, 'cv.pdf'))).rejects.toMatchObject({ code: 'ENOENT' });
    const first = await readFile(join(dir, 'cv.md'), 'utf8');
    expect(first).not.toContain('SECRET');
    expect(await readFile(join(dir, 'github-readme.md'), 'utf8')).not.toContain('Implemented retry');
    expect(await explain(join(dir, 'cv.md'))).toContain('achievement:reliable-processing');
    await build(p, 'generic', dir, false);
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toBe(first);
    await writeFile(join(dir, 'cv.md'), 'modified');
    await expect(explain(join(dir, 'cv.md'))).rejects.toThrow('Artifact changed');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
