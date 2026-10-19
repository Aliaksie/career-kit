import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { profileSchema, type Profile, type Artifact, type Target } from '../schema/profile.js';

export function validateProfile(input: unknown): Profile {
  const p = profileSchema.parse(input);
  const ids = new Set<string>();
  for (const entity of [p.person, ...p.skills, ...p.experiences, ...p.projects, ...p.achievements, ...p.education, ...p.certifications, ...p.openSourceContributions]) {
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
  for (const contribution of p.openSourceContributions) reference(contribution.project, p.projects, 'project');
  const targets = new Set<string>();
  for (const target of p.targets) {
    if (targets.has(target.name)) throw new Error(`Duplicate target: ${target.name}`);
    targets.add(target.name);
  }
  return p;
}
export async function loadProfile(path: string): Promise<Profile> {
  return validateProfile(parse(await readFile(path, 'utf8')));
}
export function disclose(p: Profile, artifact: Artifact): Profile {
  const allowed = (e: { visibility: string; disclosure: Record<Artifact, boolean> }) => e.visibility !== 'private' && e.disclosure[artifact];
  if (!allowed(p.person)) throw new Error(`Person is not disclosed for ${artifact}`);
  const experiences = p.experiences.filter(allowed);
  const skills = p.skills.filter(allowed);
  const projects = p.projects.filter(e => allowed(e) && (!e.experience || experiences.some(x => x.id === e.experience)));
  const achievements = p.achievements.filter(e => allowed(e) && projects.some(x => x.id === e.project) && e.skills.every(s => skills.some(x => x.id === s)));
  return { ...p, experiences, skills, projects, achievements, education: p.education.filter(allowed), certifications: p.certifications.filter(allowed), openSourceContributions: p.openSourceContributions.filter(e => allowed(e) && projects.some(x => x.id === e.project)) };
}
export function select(p: Profile, target: Target): Profile {
  const score = (a: Profile['achievements'][number]) => [...new Set([...a.skills, ...a.roles, ...a.domains, ...a.tags])].reduce((sum, tag) => sum + (target.priorities[tag] ?? 0), 0);
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
