import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { auditDecision, auditFile, auditProfile } from '../src/application/audit.js';
import { decideDisclosure, disclosedSources } from '../src/application/disclosure.js';
import { disclose, loadProfile, validateProfile } from '../src/application/profile.js';
import { auditSchema } from '../src/schema/audit.js';
import { compose } from '../src/renderers/documents.js';

async function example() {
  const p = await loadProfile('examples/software-engineer/profile-v2.yaml');
  return validateProfile({ ...p, person: { ...p.person, contacts: [
    { type: 'email', value: 'cv-only@example.com', visibility: 'public', disclosure: { cv: true } },
    { type: 'phone', value: '+12025550123', visibility: 'public', disclosure: { cv: true } },
    { id: 'private-contact', type: 'email', value: 'secret@example.com', visibility: 'private', disclosure: { cv: true, github: true } },
  ] } });
}
it('reports redacted deterministic decisions identical to production renderer candidates', async () => {
  const p = await example();
  for (const artifact of ['cv', 'github'] as const) {
    const result = auditProfile(p, artifact);
    expect(result.ok).toBe(true);
    expect(result).toEqual(auditProfile(p, artifact));
    expect(result.records.filter(r => r.decision === 'included').map(r => r.source).sort()).toEqual(disclosedSources(disclose(p, artifact)).sort());
    expect(result.records.find(r => r.source === 'contact:contact-1')?.decision).toBe(artifact === 'cv' ? 'included' : 'excluded');
    expect(result.records.find(r => r.source === 'contact:contact-2')?.decision).toBe(artifact === 'cv' ? 'included' : 'excluded');
    expect(JSON.stringify(result)).not.toMatch(/cv-only@example|secret@example|12025550123|https:|Fixed argument/);
    const doc = compose(disclose(p, artifact), artifact === 'github');
    expect(JSON.stringify(doc)).not.toContain('secret@example.com');
    if (artifact === 'github') expect(JSON.stringify(doc)).not.toContain('cv-only@example.com');
  }
});
it('uses direct-private, direct-denied, parent and skill precedence for dependent entities', async () => {
  const p = await example();
  if (p.version !== 2) throw new Error('Expected v2');
  p.experiences[0].disclosure.cv = false;
  p.openSourceProjects[0].disclosure.cv = false;
  const records = auditProfile(p, 'cv').records;
  expect(records.find(r => r.source === `project:${p.projects[0].id}`)?.reason).toBe('parent-excluded');
  expect(records.find(r => r.source === `achievement:${p.achievements[0].id}`)?.reason).toBe('parent-excluded');
  expect(records.find(r => r.source === `contribution:${p.openSourceContributions[0].id}`)?.reason).toBe('parent-excluded');
  p.openSourceContributions[0].visibility = 'private';
  expect(auditProfile(p, 'cv').records.find(r => r.source === `contribution:${p.openSourceContributions[0].id}`)?.reason).toBe('private');
  p.experiences[0].disclosure.cv = true;
  p.skills.find(s => s.id === p.achievements[0].skills[0])!.disclosure.cv = false;
  expect(auditProfile(p, 'cv').records.find(r => r.source === `achievement:${p.achievements[0].id}`)?.reason).toBe('skill-excluded');
  p.achievements[0].disclosure.cv = false;
  expect(auditProfile(p, 'cv').records.find(r => r.source === `achievement:${p.achievements[0].id}`)?.reason).toBe('not-disclosed');
});
it('person denial reports complete ordinary exclusions and blocks production rendering', async () => {
  const p = await example();
  p.person.disclosure.cv = false;
  const result = auditProfile(p, 'cv');
  expect(result.ok).toBe(true);
  expect(result.records.every(r => r.decision === 'excluded')).toBe(true);
  expect(result.records.find(r => r.source === 'contact:private-contact')?.reason).toBe('private');
  expect(result.records.find(r => r.source === 'contact:contact-1')?.reason).toBe('parent-excluded');
  expect(() => disclose(p, 'cv')).toThrow('Person is not disclosed');
});
it('detects disagreement at the actual disclosure boundary', async () => {
  const p = await example();
  const decision = decideDisclosure(p, 'github');
  expect(decision.profile?.version).toBe(2);
  if (decision.profile?.version !== 2 || p.version !== 2) throw new Error('Expected v2');
  decision.profile.person.contacts = p.person.contacts;
  expect(auditDecision('github', decision)).toEqual({ version: 1, ok: false, artifact: 'github', records: [], errors: [{ code: 'POLICY_VIOLATION' }] });
});
it('accounts for legacy project-linked contributions and contact-free profiles', async () => {
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  if (p.version !== 1) throw new Error('Expected v1');
  p.openSourceContributions.push({ id: 'legacy', project: p.projects[0].id, description: 'Legacy contribution', visibility: 'public', disclosure: { cv: true, github: true, portfolio: false } });
  p.projects[0].disclosure.cv = false;
  expect(auditProfile(p, 'cv').records.find(r => r.source === 'contribution:legacy')?.reason).toBe('parent-excluded');
});
it('returns redacted file failures for invalid syntax, versions, references and unsafe contacts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-audit-'));
  const path = join(dir, 'secret-profile.yaml');
  try {
    expect((await auditFile(path, 'github')).errors).toEqual([{ code: 'INPUT_UNREADABLE' }]);
    for (const [bytes, code] of [
      ['version: 999\nsecret: top-secret', 'UNSUPPORTED_PROFILE_VERSION'],
      ['[bad: top-secret', 'INVALID_PROFILE'],
      [JSON.stringify({ ...(await example()), projects: [] }), 'INVALID_PROFILE'],
      [JSON.stringify({ ...(await example()), person: { ...(await example()).person, contacts: [{ type: 'email', value: 'top-secret?bad', visibility: 'private' }] } }), 'INVALID_PROFILE'],
    ]) {
      await writeFile(path, bytes);
      const result = await auditFile(path, 'github');
      expect(result.errors).toEqual([{ code }]);
      expect(result.records).toEqual([]);
      expect(JSON.stringify(result)).not.toContain('top-secret');
      expect(JSON.stringify(result)).not.toContain(path);
    }
    expect((await auditFile(path, 'portfolio')).errors).toEqual([{ code: 'INVALID_ARTIFACT' }]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
it('CLI emits exactly one redacted JSON report on success and argument/input failures', async () => {
  const exec = promisify(execFile);
  const cli = resolve('dist/src/cli/index.js');
  const run = async (...args: string[]) => {
    try { return await exec(process.execPath, [cli, 'audit', '--json', ...args]); }
    catch (error) { return error as { stdout: string; stderr: string; code: number }; }
  };
  const success = await run('--artifact', 'github', '--profile', 'examples/software-engineer/profile-v2.yaml');
  expect(auditSchema.parse(JSON.parse(success.stdout)).ok).toBe(true);
  for (const args of [[], ['--artifact', 'private-value'], ['--artifact'], ['--artifact', 'github', '--profile', '/private-value/missing'], ['--private-value'], ['private-value']]) {
    const result = await run(...args);
    expect('code' in result && result.code).toBe(1);
    expect(auditSchema.parse(JSON.parse(result.stdout)).ok).toBe(false);
    expect(result.stdout + result.stderr).not.toContain('private-value');
    expect(result.stderr).toBe('');
  }
}, 15_000);
