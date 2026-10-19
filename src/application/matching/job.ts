import { jobSchema, type Requirement } from '../../schema/job.js';
import type { Profile } from '../../schema/profile.js';

export const normalizeTerm = (term: string): string => term.trim().toLowerCase().replace(/^skill[-\s]/, '').replace(/[\s_]+/g, '-');
const vocabulary: Record<string, string[]> = {
  java: ['java'], javascript: ['javascript', 'js'], typescript: ['typescript', 'ts'],
  python: ['python'], rust: ['rust'], go: ['go', 'golang'], 'c++': ['c++'], 'c#': ['c#'],
  ruby: ['ruby'], elixir: ['elixir'], scala: ['scala'], kotlin: ['kotlin'], swift: ['swift'],
  aws: ['aws', 'amazon web services'], azure: ['azure'], gcp: ['gcp', 'google cloud'],
  kubernetes: ['kubernetes', 'k8s'], docker: ['docker'], terraform: ['terraform'],
  postgresql: ['postgresql', 'postgres'], kafka: ['kafka'], redis: ['redis'],
  react: ['react', 'react.js'], 'node.js': ['node.js', 'nodejs'], 'spring-boot': ['spring boot'],
  'distributed-systems': ['distributed systems', 'distributed-systems'],
  architecture: ['architecture', 'architect'], 'technical-leadership': ['technical leadership', 'tech lead', 'technical lead'],
  mentoring: ['mentoring', 'mentorship'], implementation: ['implementation'],
  cloud: ['cloud'], reliability: ['reliability'], 'ai-engineering': ['ai engineering'],
};
function aliases(p: Profile): Map<string, Set<string>> {
  const result = new Map(Object.entries(vocabulary).map(([key, values]) => [key, new Set([key.replaceAll('-', ' '), ...values])]));
  for (const skill of p.skills) {
    const key = canonicalTerms(skill.name).at(-1)!;
    const values = result.get(key) ?? new Set<string>();
    values.add(skill.name.toLowerCase()); values.add(key.replaceAll('-', ' '));
    result.set(key, values);
  }
  for (const a of p.achievements) for (const term of [...a.roles, ...a.domains, ...a.tags]) {
    const key = canonicalTerms(term).at(-1)!;
    const values = result.get(key) ?? new Set<string>();
    values.add(key.replaceAll('-', ' ')); values.add(key);
    result.set(key, values);
  }
  return result;
}
function mentions(line: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z0-9])(${escaped})(?=$|[^a-z0-9+#])`, 'gi');
  for (const match of line.matchAll(pattern)) {
    const before = line.slice(Math.max(0, match.index! - 25), match.index! + match[1].length);
    const after = line.slice(match.index! + match[0].length, match.index! + match[0].length + 25);
    if (/\b(no|not|without)\s+(?:\w+\s+){0,2}$/i.test(before) || /^\s+(?:is\s+)?not\s+(?:required|needed)/i.test(after)) continue;
    return true;
  }
  return false;
}
export function extractJob(text: string, profile: Profile, structured = false): { requirements: Requirement[]; unparsed: string[]; extraction: 'structured' | 'keywords' } {
  if (!text.trim() || text.length > 100_000) throw new Error('Job description must contain 1–100000 characters');
  if (structured) {
    const { requirements } = jobSchema.parse(JSON.parse(text));
    if (new Set(requirements.map(r => r.id)).size !== requirements.length) throw new Error('Duplicate requirement ID');
    return { requirements, unparsed: [], extraction: 'structured' };
  }
  const dictionary = aliases(profile);
  const found = new Map<string, Requirement>();
  const unparsed: string[] = [];
  let sectionImportance: 'required' | 'preferred' = 'required';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(?:#+\s*)?(?:nice[- ]to[- ]have|preferred|optional|bonus)(?:\s+(?:skills|qualifications|requirements))?:?$/i.test(line)) { sectionImportance = 'preferred'; continue; }
    else if (/^(?:#+\s*)?(?:required|requirements|must[- ]have|essential)(?:\s+(?:skills|qualifications|requirements))?:?$/i.test(line)) { sectionImportance = 'required'; continue; }
    const importance = /\b(preferred|optional|nice[- ]to[- ]have|bonus)\b/i.test(line) ? 'preferred' : sectionImportance;
    let recognized = false;
    for (const [key, values] of dictionary) {
      if (![...values].some(alias => mentions(line, alias))) continue;
      recognized = true;
      const id = key.replace(/\+/g, 'plus').replace(/#/g, 'sharp').replace(/[^a-z0-9-]/g, '-').replace(/-+$/, '');
      const previous = found.get(key);
      found.set(key, { id: `requirement-${id}`, label: key.replaceAll('-', ' '), terms: [key], importance: previous?.importance === 'required' ? 'required' : importance });
    }
    if (!recognized && /^(?:[-*+]\s|\d+[.)]\s)|\b(required|must|experience|proficien)\b/i.test(line)) unparsed.push(line);
  }
  if (!found.size) throw new Error('No recognized requirements; supply a structured JSON job with explicit terms');
  return { requirements: [...found.values()], unparsed, extraction: 'keywords' };
}
export function canonicalTerms(term: string): string[] {
  const normalized = normalizeTerm(term);
  const canonical = Object.entries(vocabulary).find(([key, values]) => key === normalized || values.some(alias => normalizeTerm(alias) === normalized))?.[0];
  return [...new Set([normalized, ...(canonical ? [canonical] : [])])];
}
