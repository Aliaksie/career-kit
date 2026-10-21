import nunjucks from 'nunjucks';
import type { Profile } from '../schema/profile.js';
import type { AchievementOrder } from '../schema/polish.js';
import { loadTemplates, type Templates } from './templates.js';

export type Claim = { text: string; sources: string[] };
export type Document = { markdown: string; html: string; claims: Claim[]; htmlClaims: Claim[] };
export function markdownText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]()#+.!|~>-]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}
function htmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Templates arrange opaque tokens. Only tokens present in the final output become claims.
export function compose(p: Profile, github = false, orders: ReadonlyMap<string, AchievementOrder> = new Map(), templates: Templates = loadTemplates()): Document {
  const entries: { claim: Claim; html: string; markdown: string }[] = [];
  const token = (text: string, sources: string[], href?: string) => {
    const destination = href?.replace(/[<>\\]/g, c => encodeURIComponent(c));
    const index = entries.push({ claim: { text: href ? `${text} — ${href}` : text, sources },
      html: href ? `<a href="${htmlText(href)}">${htmlText(text)}</a>` : htmlText(text),
      markdown: href ? `[${markdownText(text)}](<${destination}>)` : markdownText(text) }) - 1;
    return `CAREER_TOKEN_${index}_END`;
  };
  const options = { maxSkills: github ? 12 : 24, maxProjects: github ? 3 : 4, maxBulletsPerProject: github ? 2 : 3, maxCertifications: github ? 0 : 6, ...p.presentation?.[github ? 'github' : 'cv'] };
  const personSource = [`person:${p.person.id}`];
  const person = { name: token(p.person.name, personSource), headline: token(p.person.headline, personSource), summary: p.person.summary ? token(p.person.summary, personSource) : undefined,
    contacts: p.version === 2 ? (p.person.contacts ?? []).map(c => token(c.value, [`contact:${c.id}`, ...personSource], c.type === 'email' ? `mailto:${encodeURIComponent(c.value)}` : c.type === 'phone' ? `tel:${c.value}` : c.value)) : [] };
  const usedSkills = new Set(p.achievements.flatMap(a => a.skills));
  const rankedSkills = [...p.skills].sort((a, b) => Number(usedSkills.has(b.id)) - Number(usedSkills.has(a.id)));
  const skills: { label: string; items: string[] }[] = [];
  for (const skill of rankedSkills.slice(0, options.maxSkills)) {
    const label = skill.group ?? 'Technical skills';
    let group = skills.find(g => g.label === label);
    if (!group) { group = { label, items: [] }; skills.push(group); }
    group.items.push(token(skill.name, [`skill:${skill.id}`]));
  }
  // Labels are supplied facts too; omitted groups must not leave provenance behind.
  for (const group of skills) {
    const ids = rankedSkills.slice(0, options.maxSkills).filter(s => (s.group ?? 'Technical skills') === group.label).map(s => `skill:${s.id}`);
    group.label = token(group.label, ids);
  }
  const achievementProjects = new Set(p.achievements.map(a => a.project));
  const featuredIds = new Set(p.projects.filter(project => achievementProjects.has(project.id)).slice(0, options.maxProjects).map(project => project.id));
  const projectView = (project: Profile['projects'][number], detail: boolean) => {
    const sources = [`project:${project.id}`];
    return { name: token(project.name, sources), description: detail ? token(project.description, sources) : undefined,
      bullets: detail ? p.achievements.filter(a => a.project === project.id).slice(0, options.maxBulletsPerProject).map(a => {
        // CV prose leads with the action; explicit provider ordering remains respected.
        const parts = orders.get(a.id) === 'context-first' ? [a.statement.problem, a.statement.action, a.statement.outcome] : [a.statement.action, a.statement.problem, a.statement.outcome];
        return token(parts.join(' '), [`achievement:${a.id}`, ...sources]);
      }) : [] };
  };
  const experiences = github ? [] : p.experiences.map(role => {
    const sources = [`experience:${role.id}`];
    const projects = p.projects.filter(project => project.experience === role.id);
    return { organization: token(role.organization, sources), title: token(role.title, sources), dates: token(`${role.start} – ${role.end ?? 'present'}`, sources),
      projects: projects.filter(project => featuredIds.has(project.id)).map(project => projectView(project, true)),
      earlier: projects.filter(project => !featuredIds.has(project.id)).map(project => projectView(project, false)) };
  });
  const independent = p.projects.filter(project => github || !project.experience).filter(project => featuredIds.has(project.id)).map(project => projectView(project, true));
  const openSource: { name: string; description?: string; summary?: string }[] = [];
  if (p.version === 2) for (const project of [...p.openSourceProjects].sort((a, b) => Number(b.relationship === 'own') - Number(a.relationship === 'own'))) {
    const source = `open-source-project:${project.id}`;
    const contributions = p.openSourceContributions.filter(c => c.openSourceProject === project.id && (c.status === 'merged' || c.status === 'completed' || c.status === 'active' || c.status === 'former'));
    openSource.push({ name: token(project.name, [source], project.repository),
      description: project.description ? token(project.description, [source]) : undefined,
      summary: project.relationship !== 'own' && contributions.length ? token(contributions.map(c => c.status === 'former' ? `Former maintainer: ${c.description}` : c.description).join(' '), [...contributions.map(c => `contribution:${c.id}`), source]) : undefined });
  }
  if (p.version === 1) for (const c of p.openSourceContributions) openSource.push({ name: token(c.description, [`contribution:${c.id}`, `project:${c.project}`]) });
  const view = { version: 1, person, skills, experiences, projects: independent, openSource,
    education: github ? [] : p.education.map(e => token(`${e.qualification} — ${e.institution}`, [`education:${e.id}`])),
    certifications: (options.certificationIds ? options.certificationIds.flatMap(id => p.certifications.filter(c => c.id === id)) : p.certifications).slice(0, options.maxCertifications).map(c => token(`${c.name} — ${c.issuer}`, [`certification:${c.id}`])) };
  const env = new nunjucks.Environment([], { autoescape: true, throwOnUndefined: true });
  const render = (template: string, format: 'html' | 'markdown') => {
    const emitted = new Map<number, Claim>();
    const output = env.renderString(template, { view }).replace(/CAREER_TOKEN_(\d+)_END/g, (_, id: string) => {
      const entry = entries[Number(id)];
      if (!entry) throw new Error('Template emitted an unknown content token');
      emitted.set(Number(id), entry.claim);
      return entry[format];
    });
    if (!emitted.size) throw new Error('Template must emit disclosed content tokens');
    return { output, claims: [...emitted.values()] };
  };
  const md = render(github ? templates.githubMarkdown : templates.cvMarkdown, 'markdown');
  const html = render(templates.cvHtml, 'html');
  return { markdown: md.output, html: html.output, claims: md.claims, htmlClaims: html.claims };
}
