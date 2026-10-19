import { createHash } from 'node:crypto';
import { disclose, select } from '../profile.js';
import { extractJob, canonicalTerms } from './job.js';
import type { Profile } from '../../schema/profile.js';
import type { Requirement, Tailoring } from '../../schema/job.js';

type Achievement = Profile['achievements'][number];
function evidenceTerms(p: Profile, achievement: Achievement): Set<string> {
  const skills = achievement.skills.flatMap(id => [id, p.skills.find(s => s.id === id)!.name]);
  return new Set([...skills, ...achievement.roles, ...achievement.domains, ...achievement.tags].flatMap(canonicalTerms));
}
function matches(p: Profile, a: Achievement, requirement: Requirement): boolean {
  const terms = evidenceTerms(p, a);
  return requirement.terms.flatMap(canonicalTerms).some(term => terms.has(term));
}
export function matchJob(profile: Profile, job: string, targetName: string, structured = false): { profile: Profile; report: Tailoring } {
  const target = profile.targets.find(t => t.name === targetName);
  if (!target) throw new Error(`Unknown target: ${targetName}`);
  const p = disclose(profile, 'cv');
  const extracted = extractJob(job, p, structured);
  const score = (a: Achievement) => extracted.requirements.reduce((n, r) => n + (matches(p, a, r) ? (r.importance === 'required' ? 2 : 1) : 0), 0);
  // Target priorities break ties; they never make unrelated evidence relevant.
  const tie = (a: Achievement) => [...new Set([...a.skills, ...a.roles, ...a.domains, ...a.tags])].reduce((n, t) => n + (target.priorities[t] ?? 0), 0);
  const maxTie = Math.max(0, ...p.achievements.map(tie));
  const selected = select({ ...p, achievements: p.achievements.filter(a => score(a) > 0) }, target, a => score(a) + tie(a) / (maxTie + 1) / 2);
  const projectIds = new Set(selected.achievements.map(a => a.project));
  const projects = selected.projects.filter(p => projectIds.has(p.id));
  const experiences = selected.experiences.filter(e => projects.some(p => p.experience === e.id));
  const skills = selected.skills.filter(s => selected.achievements.some(a => a.skills.includes(s.id)));
  const result = { ...selected, projects, experiences, skills, openSourceContributions: selected.openSourceContributions.filter(c => projectIds.has(c.project)) };
  const report: Tailoring = {
    jobSha256: createHash('sha256').update(job).digest('hex'), extraction: extracted.extraction, unparsed: extracted.unparsed,
    coverage: extracted.requirements.map(requirement => ({ requirement,
      matched: p.achievements.filter(a => matches(p, a, requirement)).map(a => a.id),
      selected: selected.achievements.filter(a => matches(p, a, requirement)).map(a => a.id),
    })),
  };
  return { profile: result, report };
}
