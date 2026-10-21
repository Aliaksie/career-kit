import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { disclose, loadProfile, select, validateProfile } from '../src/application/profile.js';
import { build, explain } from '../src/application/build.js';
import { verifyBundle } from '../src/application/bundle.js';
import { matchJob } from '../src/application/matching/match.js';
import { tailor } from '../src/application/tailor.js';
import { compose } from '../src/renderers/documents.js';
import { loadTemplates } from '../src/renderers/templates.js';

it('groups skills and assignments under an employer and compacts earlier work', async () => {
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  p.skills[0].group = 'Backend';
  p.presentation = { cv: { maxSkills: 1, maxProjects: 1, maxBulletsPerProject: 1, maxCertifications: 0 } };
  p.projects.push({ ...p.projects[0], id: 'earlier', name: 'Earlier assignment' });
  const doc = compose(select(disclose(p, 'cv'), p.targets[0]));
  expect(doc.markdown).toContain('**Backend:** TypeScript');
  expect(doc.markdown.indexOf('Example Systems')).toBeLessThan(doc.markdown.indexOf('Sample Service'));
  expect(doc.markdown).toContain('Other assignments: Earlier assignment');
  expect(doc.markdown).not.toContain('## Selected Work');
  expect(doc.html).toContain('<ul><li>');
});

it('applies presentation budgets before matching reports are finalized', async () => {
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  p.presentation = { cv: { maxBulletsPerProject: 1 } };
  p.achievements.push({ ...p.achievements[0], id: 'second' });
  const result = matchJob(p, 'TypeScript required', 'generic');
  expect(result.report.coverage[0].matched).toHaveLength(2);
  expect(result.report.coverage[0].selected).toHaveLength(1);
  const claims = compose(result.profile).claims;
  expect(result.report.coverage[0].selected.every(id => claims.some(c => c.sources.includes(`achievement:${id}`)))).toBe(true);
  expect(() => validateProfile({ ...p, presentation: { cv: { maxSkills: -1 } } })).toThrow();
});

it('uses distinct GitHub composition without duplicate career-project sections', async () => {
  const p = await loadProfile('examples/software-engineer/profile-v2.yaml');
  const doc = compose(disclose(p, 'github'), true);
  expect(doc.markdown).toContain('Public projects and contributions');
  expect(doc.markdown).not.toContain('Selected work');
  expect(doc.markdown).not.toMatch(/pr \\(merged\\)|closed-unmerged|Professional experience|Certifications/);
  expect(doc.claims.some(c => c.sources.includes('project:sample-service'))).toBe(false);
});

it('loads consumer templates for build and tailor, tracking only emitted content separately per format', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-templates-'));
  try {
    await writeFile(join(dir, 'cv.html.njk'), '<html><body><h1>{{ view.person.name }}</h1><p>{{ view.person.headline }}</p></body></html>');
    await writeFile(join(dir, 'cv.md.njk'), '# Custom CV\n{{ view.person.name }}\n');
    await writeFile(join(dir, 'github.md.njk'), '# Public\n{{ view.person.name }}\n');
    const p = await loadProfile('examples/software-engineer/profile-v2.yaml');
    p.person.name = '<script>[unsafe](javascript:alert(1))</script>';
    const output = join(dir, 'output');
    await build(p, 'generic', output, false, dir);
    await verifyBundle(output);
    const md = await readFile(join(output, 'cv.md'), 'utf8');
    expect(md).toContain('# Custom CV');
    expect(md).not.toContain('[unsafe](');
    expect(await readFile(join(output, 'cv.html'), 'utf8')).not.toContain('<script>');
    const mdClaims = JSON.parse(await readFile(join(output, 'cv.md.claims.json'), 'utf8')).claims;
    const htmlClaims = JSON.parse(await readFile(join(output, 'cv.html.claims.json'), 'utf8')).claims;
    expect(mdClaims).toHaveLength(1);
    expect(htmlClaims).toHaveLength(2);
    expect(await explain(join(output, 'cv.md'))).not.toContain('achievement:');
    expect(await explain(join(output, 'github-readme.md'))).not.toContain('contact:');
    await tailor(p, 'TypeScript required', output, { pdf: false, templateDirectory: dir });
    await verifyBundle(output);
    expect(await readFile(join(output, 'cv.md'), 'utf8')).toBe(md);
    await writeFile(join(dir, 'cv.md.njk'), '{% if false %}{{ view.person.headline }}{% endif %}{{ view.person.name }}');
    const doc = compose(disclose(p, 'cv'), false, undefined, loadTemplates(dir));
    expect(doc.claims).toHaveLength(1);
    await writeFile(join(dir, 'cv.md.njk'), '{{ missing }}');
    await expect(build(p, 'generic', output, false, dir)).rejects.toThrow();
    expect(await readFile(join(output, 'cv.md'), 'utf8')).toBe(md);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
