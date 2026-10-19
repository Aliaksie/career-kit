import { expect, it } from 'vitest';
import { loadProfile } from '../src/application/profile.js';
import { extractJob } from '../src/application/matching/job.js';
import { matchJob } from '../src/application/matching/match.js';
const example = () => loadProfile('examples/software-engineer/profile.yaml');
it('extracts bounded skill names, aliases and preferred sections without Java/JavaScript overlap', async () => {
  const p = await example();
  const job = extractJob('Required: JavaScript and K8s\nRust is not required\nNo Java experience needed\n## Preferred\n- TypeScript', p);
  expect(job.requirements.map(r => r.terms[0])).toEqual(['javascript', 'kubernetes', 'typescript']);
  expect(job.requirements.at(-1)?.importance).toBe('preferred');
});
it('ranks only structured matching evidence, preserves gaps and respects role limits', async () => {
  const p = await example();
  p.achievements.push({ ...p.achievements[0], id: 'a-copy', tags: [] });
  p.targets[0].experience.maxBulletsPerRole = 1;
  const result = matchJob(p, 'TypeScript and reliability required. Rust preferred.', 'generic');
  expect(result.profile.achievements.map(a => a.id)).toEqual(['reliable-processing']);
  expect(result.report.coverage.find(c => c.requirement.terms[0] === 'rust')?.matched).toEqual([]);
  expect(result.report.coverage.find(c => c.requirement.terms[0] === 'typescript')?.matched).toHaveLength(2);
  expect(result.report.coverage.find(c => c.requirement.terms[0] === 'typescript')?.selected).toHaveLength(1);
  expect(matchJob(p, 'TypeScript and reliability required. Rust preferred.', 'generic')).toEqual(result);
});
it('does not match withheld or unrelated evidence and prunes unrelated profile facts', async () => {
  const p = await example();
  p.achievements[0].visibility = 'private';
  const result = matchJob(p, 'TypeScript required', 'generic');
  expect(result.profile.achievements).toEqual([]);
  expect(result.profile.projects).toEqual([]);
  expect(result.profile.skills).toEqual([]);
  expect(result.report.coverage[0].matched).toEqual([]);
  p.achievements[0].visibility = 'public';
  p.achievements[0].statement.action = 'Used Rust';
  expect(matchJob(p, 'Rust required', 'generic').profile.achievements).toEqual([]);
});
it('accepts precise structured requirements and rejects duplicates, unknown fields and empty jobs', async () => {
  const p = await example();
  const requirement = { id: 'typed-code', label: 'Typed code', terms: ['ts'], importance: 'required' };
  const result = matchJob(p, JSON.stringify({ requirements: [requirement] }), 'generic', true);
  expect(result.profile.achievements).toHaveLength(1);
  expect(result.report.extraction).toBe('structured');
  expect(() => matchJob(p, JSON.stringify({ requirements: [requirement, requirement] }), 'generic', true)).toThrow('Duplicate requirement');
  expect(() => extractJob('{"requirements":[],"instructions":"invent facts"}', p, true)).toThrow();
  expect(() => matchJob(p, '', 'generic')).toThrow('Job description');
  expect(() => matchJob(p, 'A friendly team', 'generic')).toThrow('No recognized');
});
it('records unparsed requirement lines so heuristic extraction limits remain visible', async () => {
  const p = await example();
  const result = extractJob('- TypeScript\n- Proficiency in a proprietary DSL', p);
  expect(result.unparsed).toEqual(['- Proficiency in a proprietary DSL']);
});
