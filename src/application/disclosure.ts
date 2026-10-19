import type { Profile, Artifact } from '../schema/profile.js';
import type { AuditRecord } from '../schema/audit.js';

type Fact = { id: string; visibility: string; disclosure: Record<Artifact, boolean> };
export type DisclosureDecision = { profile: Profile | undefined; records: AuditRecord[] };
export function decideDisclosure(p: Profile, artifact: Artifact): DisclosureDecision {
  const records: AuditRecord[] = [];
  const included = new Set<string>();
  const allow = (e: Fact, prefix: string, parents: string[] = [], skills: string[] = []) => {
    const source = `${prefix}:${e.id}`;
    const reason = e.visibility === 'private' ? 'private' : !e.disclosure[artifact] ? 'not-disclosed' : parents.some(id => !included.has(id)) ? 'parent-excluded' : skills.some(id => !included.has(id)) ? 'skill-excluded' : 'allowed';
    records.push({ source, reason, decision: reason === 'allowed' ? 'included' : 'excluded' });
    if (reason === 'allowed') included.add(source);
    return reason === 'allowed';
  };
  const personAllowed = allow(p.person, 'person');
  const parent = [`person:${p.person.id}`];
  const contacts = p.version === 2 ? p.person.contacts?.filter(e => allow(e, 'contact', parent)) : undefined;
  const skills = p.skills.filter(e => allow(e, 'skill', parent));
  const experiences = p.experiences.filter(e => allow(e, 'experience', parent));
  const projects = p.projects.filter(e => allow(e, 'project', [...parent, ...(e.experience ? [`experience:${e.experience}`] : [])]));
  const achievements = p.achievements.filter(e => allow(e, 'achievement', [...parent, `project:${e.project}`], e.skills.map(id => `skill:${id}`)));
  const education = p.education.filter(e => allow(e, 'education', parent));
  const certifications = p.certifications.filter(e => allow(e, 'certification', parent));
  const common = { skills, experiences, projects, achievements, education, certifications };
  if (p.version === 1) {
    const openSourceContributions = p.openSourceContributions.filter(e => allow(e, 'contribution', [...parent, `project:${e.project}`]));
    return { records, profile: personAllowed ? { ...p, ...common, openSourceContributions } : undefined };
  }
  const openSourceProjects = p.openSourceProjects.filter(e => allow(e, 'open-source-project', parent));
  const openSourceContributions = p.openSourceContributions.filter(e => allow(e, 'contribution', [...parent, `open-source-project:${e.openSourceProject}`]));
  return { records, profile: personAllowed ? { ...p, ...common, person: { ...p.person, ...(contacts ? { contacts } : {}) }, openSourceProjects, openSourceContributions } : undefined };
}
// Enumerate actual renderer candidates independently of the recorded decisions.
export function disclosedSources(p: Profile | undefined): string[] {
  if (!p) return [];
  const sources = [`person:${p.person.id}`];
  const add = (prefix: string, entities: { id: string }[]) => sources.push(...entities.map(e => `${prefix}:${e.id}`));
  if (p.version === 2) add('contact', p.person.contacts ?? []);
  add('skill', p.skills); add('experience', p.experiences); add('project', p.projects);
  add('achievement', p.achievements); add('education', p.education); add('certification', p.certifications);
  if (p.version === 2) add('open-source-project', p.openSourceProjects);
  add('contribution', p.openSourceContributions);
  return sources;
}
