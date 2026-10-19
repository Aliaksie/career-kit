import { describe, expect, it } from 'vitest';
import { loadProfile, validateProfile, disclose, select } from '../src/application/profile.js';

const example = () => loadProfile('examples/software-engineer/profile.yaml');
describe('profile compiler', () => {
  it('rejects unknown references and duplicate IDs', async () => {
    const p = await example();
    p.achievements[0].skills = ['missing'];
    expect(() => validateProfile(p)).toThrow('Unknown skill');
    p.achievements[0].skills = [];
    p.projects[0].id = p.person.id;
    expect(() => validateProfile(p)).toThrow('Duplicate entity ID');
  });
  it('removes private parents and their dependent evidence', async () => {
    const p = await example();
    p.experiences[0].visibility = 'private';
    const result = disclose(p, 'cv');
    expect(result.experiences).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.achievements).toEqual([]);
  });
  it('requires explicit artifact disclosure and excludes withheld skills', async () => {
    const p = await example();
    p.skills[0].disclosure.github = false;
    expect(disclose(p, 'github').achievements).toEqual([]);
    expect(disclose(p, 'cv').achievements).toHaveLength(1);
  });
  it('ranks evidence deterministically and limits bullets per role', async () => {
    const p = await example();
    p.achievements.push({ ...p.achievements[0], id: 'another', tags: [] });
    const target = { ...p.targets[0], experience: { maxBulletsPerRole: 1 } };
    expect(select(p, target).achievements.map(a => a.id)).toEqual(['reliable-processing']);
    expect(select(p, target)).toEqual(select(p, target));
  });
});
it('rejects malformed fields, invalid dates, unknown projects and target duplication', async () => {
  const original = await example();
  expect(() => validateProfile({ ...original, extra: true })).toThrow();
  const missingProject = structuredClone(original);
  missingProject.achievements[0].project = 'missing';
  expect(() => validateProfile(missingProject)).toThrow('Unknown project');
  const dates = structuredClone(original);
  dates.experiences[0].end = '2021-12';
  expect(() => validateProfile(dates)).toThrow('End precedes start');
  const targets = structuredClone(original);
  targets.targets.push(targets.targets[0]);
  expect(() => validateProfile(targets)).toThrow('Duplicate target');
});
it('defaults disclosure flags to false and refuses an undisclosed person', async () => {
  const p = await example();
  const input = { ...p, person: { ...p.person, disclosure: {} } };
  const validated = validateProfile(input);
  expect(validated.person.disclosure).toEqual({ cv: false, github: false, portfolio: false });
  expect(() => disclose(validated, 'cv')).toThrow('Person is not disclosed');
});
