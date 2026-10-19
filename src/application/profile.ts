import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { decideDisclosure } from './disclosure.js';
import { sha256 } from './metadata.js';
import { profileSchema, type Profile, type Artifact, type Target } from '../schema/profile.js';

const sourceDigests = new WeakMap<object, { snapshot: string; digest: string }>();
export function profileDigest(p: Profile): string {
  const snapshot = JSON.stringify(p);
  const source = sourceDigests.get(p);
  return source?.snapshot === snapshot ? source.digest : sha256(snapshot);
}

export function validateProfile(input: unknown): Profile {
  const p = profileSchema.parse(input);
  const ids = new Set<string>();
  for (const entity of [p.person, ...p.skills, ...p.experiences, ...p.projects, ...p.achievements, ...p.education, ...p.certifications, ...p.openSourceContributions, ...(p.version === 2 ? [...p.openSourceProjects, ...(p.person.contacts ?? [])] : [])]) {
    if (ids.has(entity.id)) throw new Error(`Duplicate entity ID: ${entity.id}`);
    ids.add(entity.id);
  }
  const reference = (value: string, collection: { id: string }[], label: string) => {
    if (!collection.some(e => e.id === value)) throw new Error(`Unknown ${label}: ${value}`);
  };
  for (const e of p.experiences) if (e.end && e.end < e.start) throw new Error(`End precedes start: ${e.id}`);
  for (const project of p.projects) if (project.experience) reference(project.experience, p.experiences, 'experience');
  for (const achievement of p.achievements) {
    reference(achievement.project, p.projects, 'project');
    for (const skill of achievement.skills) reference(skill, p.skills, 'skill');
  }
  if (p.version === 1) {
    for (const contribution of p.openSourceContributions) reference(contribution.project, p.projects, 'project');
  } else {
    const repositories = new Set<string>();
    for (const project of p.openSourceProjects) {
      if (repositories.has(project.repository)) throw new Error(`Duplicate open-source repository: ${project.id}`);
      repositories.add(project.repository);
    }
    for (const contribution of p.openSourceContributions) reference(contribution.openSourceProject, p.openSourceProjects, 'open-source project');
  }
  const targets = new Set<string>();
  for (const target of p.targets) {
    if (targets.has(target.name)) throw new Error(`Duplicate target: ${target.name}`);
    targets.add(target.name);
  }
  return p;
}
export async function loadProfile(path: string): Promise<Profile> {
  const bytes = await readFile(path);
  const p = validateProfile(parse(bytes.toString('utf8')));
  sourceDigests.set(p, { snapshot: JSON.stringify(p), digest: sha256(bytes) });
  return p;
}
export function disclose(p: Profile, artifact: Artifact): Profile {
  const result = decideDisclosure(p, artifact);
  if (!result.profile) throw new Error(`Person is not disclosed for ${artifact}`);
  return result.profile;
}
export function select(p: Profile, target: Target, scoring?: (a: Profile['achievements'][number]) => number): Profile {
  const score = scoring ?? ((a: Profile['achievements'][number]) => [...new Set([...a.skills, ...a.roles, ...a.domains, ...a.tags])].reduce((sum, tag) => sum + (target.priorities[tag] ?? 0), 0));
  const counts = new Map<string, number>();
  const achievements = [...p.achievements].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id, 'en')).filter(a => {
    const role = p.projects.find(x => x.id === a.project)?.experience ?? a.project;
    const count = counts.get(role) ?? 0;
    if (count >= target.experience.maxBulletsPerRole) return false;
    counts.set(role, count + 1);
    return true;
  }).slice(0, target.maxAchievements);
  return { ...p, achievements };
}
