import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { disclose, loadProfile, validateProfile } from '../src/application/profile.js';
import { build, explain } from '../src/application/build.js';
import { matchJob } from '../src/application/matching/match.js';
import { tailor } from '../src/application/tailor.js';
import { compose } from '../src/renderers/documents.js';
import type { LanguageModel } from '../src/llm/provider.js';

async function example() {
  const p = await loadProfile('examples/software-engineer/profile-v2.yaml');
  if (p.version !== 2) throw new Error('Expected v2 fixture');
  return p;
}

it('retains legacy project-linked contribution rendering, provenance and tailoring', async () => {
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  if (p.version !== 1) throw new Error('Expected v1 fixture');
  p.openSourceContributions.push({ id: 'legacy-fix', project: 'sample-service', description: 'Legacy fix.', visibility: 'public', disclosure: { cv: true, github: true, portfolio: false } });
  const validated = validateProfile(p);
  const rendered = compose(disclose(validated, 'cv'));
  expect(rendered.markdown).toContain('Legacy fix\\.');
  expect(rendered.claims).toContainEqual({ text: 'Legacy fix.', sources: ['contribution:legacy-fix', 'project:sample-service'] });
  expect(matchJob(validated, 'Rust required', 'generic').profile.openSourceContributions).toEqual([]);
  p.projects[0].disclosure.cv = false;
  expect(disclose(p, 'cv').openSourceContributions).toEqual([]);
});

it('keeps independent contributions when career work is withheld or unmatched', async () => {
  const p = await example();
  p.experiences[0].visibility = 'private';
  const cv = disclose(p, 'cv');
  expect(cv.projects).toEqual([]);
  expect(cv.openSourceContributions).toHaveLength(2);
  const tailored = matchJob(p, 'Rust required', 'generic');
  expect(tailored.profile.achievements).toEqual([]);
  expect(tailored.profile.openSourceContributions).toHaveLength(2);
  expect(compose(tailored.profile).html).toContain('Fixed argument validation');
  expect(compose(tailored.profile).html).not.toContain('closed-unmerged');
  expect(compose(tailored.profile).claims.some(c => c.sources.includes('contribution:tools-pr-19'))).toBe(false);
  expect(tailored.report.coverage[0].matched).toEqual([]);
});

it('enforces both repository and contribution permissions before rendering', async () => {
  const p = await example();
  expect(disclose(p, 'cv').openSourceContributions).toHaveLength(2);
  expect(disclose(p, 'github').openSourceContributions.map(c => c.id)).toEqual(['tools-pr-12']);
  p.openSourceProjects[0].disclosure.github = false;
  const github = disclose(p, 'github');
  if (github.version !== 2) throw new Error('Expected v2');
  expect(github.openSourceProjects).toEqual([]);
  expect(github.openSourceContributions).toEqual([]);
  expect(compose(github, true).html).not.toContain('example-tools');
  p.openSourceProjects[0].visibility = 'private';
  expect(disclose(p, 'cv').openSourceContributions).toEqual([]);
  p.openSourceProjects[0].visibility = 'public';
  p.openSourceContributions[0].visibility = 'private';
  p.openSourceContributions[1].disclosure.cv = false;
  const rendered = compose(disclose(p, 'cv'));
  expect(rendered.markdown).toContain('Example Tools'); // Explicitly disclosed empty repository.
  expect(JSON.stringify(rendered)).not.toContain('Fixed argument validation');
  expect(JSON.stringify(rendered)).not.toContain('alternative transport');
  const omitted = validateProfile({ ...p, openSourceProjects: [{ ...p.openSourceProjects[0], disclosure: {} }] });
  expect(disclose(omitted, 'cv').openSourceContributions).toEqual([]);
});

it('rejects duplicate global IDs, canonical repositories and invalid references', async () => {
  const p = await example();
  expect(() => validateProfile({ ...p, openSourceProjects: [{ ...p.openSourceProjects[0], id: p.person.id }] })).toThrow('Duplicate entity ID');
  expect(() => validateProfile({ ...p, openSourceContributions: [{ ...p.openSourceContributions[0], id: p.openSourceProjects[0].id }] })).toThrow('Duplicate entity ID');
  expect(() => validateProfile({ ...p, openSourceContributions: [{ ...p.openSourceContributions[0], openSourceProject: 'missing' }] })).toThrow('Unknown open-source project');
  expect(() => validateProfile({ ...p, openSourceProjects: [...p.openSourceProjects, { ...p.openSourceProjects[0], id: 'second', repository: 'https://GITHUB.COM/example/example-tools/' }] })).toThrow('Duplicate open-source repository');
  expect(() => validateProfile({ ...p, version: 3 })).toThrow();
  expect(() => validateProfile({ ...p, openSourceContributions: [{ ...p.openSourceContributions[0], project: 'sample-service' }] })).toThrow();
  expect(() => validateProfile({ ...p, version: 1 })).toThrow();
});

it('validates kind-specific statuses and URLs without inferring upstream delivery', async () => {
  const p = await example();
  const base = { id: 'contribution', openSourceProject: p.openSourceProjects[0].id, description: 'Work.', visibility: 'public', disclosure: { cv: true } };
  for (const [kind, status] of [['documentation', 'completed'], ['other', 'proposed'], ['maintainer', 'active']]) {
    expect(validateProfile({ ...p, openSourceContributions: [{ ...base, kind, status }] }).openSourceContributions).toHaveLength(1);
  }
  expect(() => validateProfile({ ...p, openSourceContributions: [{ ...base, kind: 'pr', status: 'merged' }] })).toThrow();
  expect(() => validateProfile({ ...p, openSourceContributions: [{ ...base, kind: 'issue', status: 'merged', url: 'https://example.com/issues/1' }] })).toThrow();
  expect(() => validateProfile({ ...p, openSourceContributions: [{ ...base, kind: 'maintainer', status: 'completed' }] })).toThrow();
  expect(validateProfile({ ...p, openSourceContributions: [{ ...base, kind: 'issue', status: 'closed', url: 'https://example.com/issues/1' }] }).openSourceContributions).toHaveLength(1);
});

it('rejects unsafe links even when withheld and escapes untrusted link labels', async () => {
  const p = await example();
  for (const repository of ['javascript:alert(1)', 'http://example.com/repo', 'https://user:pass@example.com/repo', 'https://example.com/repo?token=secret', 'https://example.com/repo#private', 'https://example.com/\nrepo', 'https://example.com\\repo']) {
    expect(() => validateProfile({ ...p, openSourceProjects: [{ ...p.openSourceProjects[0], repository, visibility: 'private' }] })).toThrow();
    expect(() => validateProfile({ ...p, openSourceContributions: [{ ...p.openSourceContributions[0], url: repository }] })).toThrow();
  }
  p.openSourceProjects[0].name = '<img src=x onerror=alert(1)> [inject](javascript:alert(1))';
  p.openSourceContributions[0].description = '<script>alert(1)</script>';
  const doc = compose(disclose(validateProfile(p), 'cv'));
  expect(doc.html).not.toContain('<img');
  expect(doc.html).not.toContain('<script>');
  expect(doc.html).toContain('href="https://github.com/example/example-tools"');
  expect(doc.markdown).not.toContain('[inject](');
  expect(doc.markdown).toContain('](<https://github.com/example/example-tools>)');
});

it('writes independent provenance through generic/tailored builds and isolates provider input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-oss-'));
  try {
    const p = await example();
    await build(p, 'generic', dir, false);
    const claims = JSON.parse(await readFile(join(dir, 'cv.md.claims.json'), 'utf8')).claims;
    expect(claims).toContainEqual({ text: 'Fixed argument validation.', sources: ['contribution:tools-pr-12', 'open-source-project:oss-example-tools'] });
    expect(await explain(join(dir, 'cv.html'))).toContain('open-source-project:oss-example-tools');
    const github = await explain(join(dir, 'github-readme.md'));
    expect(github).toContain('tools-pr-12');
    expect(github).not.toContain('tools-pr-19');
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
    expect(await explain(join(dir, 'cv.md'))).toContain('contribution:tools-pr-12');
    expect(await explain(join(dir, 'cv.md'))).not.toContain('contribution:tools-pr-19');
    await tailor(p, 'TypeScript required', dir, { pdf: false });
    const first = await readFile(join(dir, 'cv.md'), 'utf8');
    await tailor(p, 'TypeScript required', dir, { pdf: false });
    expect(await readFile(join(dir, 'cv.md'), 'utf8')).toBe(first);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
