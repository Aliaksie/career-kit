import nunjucks from 'nunjucks';
import type { Profile } from '../schema/profile.js';
import type { AchievementOrder } from '../schema/polish.js';

export type Claim = { text: string; sources: string[] };
export type Document = { markdown: string; html: string; claims: Claim[] };
// Encode source punctuation and HTML so profile text cannot create Markdown links or tags.
export function markdownText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]()#+.!|~>-]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}
export function compose(p: Profile, github = false, orders: ReadonlyMap<string, AchievementOrder> = new Map()): Document {
  const claims: Claim[] = [];
  const lines: string[] = [];
  const blocks: { heading?: string; text?: string; bullet?: boolean; level?: number; href?: string }[] = [];
  const heading = (text: string, level = 2, sources?: string[]) => { if (sources) claims.push({ text, sources }); lines.push(`${'#'.repeat(level)} ${markdownText(text)}`, ''); blocks.push({ heading: text, level }); };
  const statement = (text: string, sources: string[], bullet = false) => {
    claims.push({ text, sources }); lines.push(`${bullet ? '- ' : ''}${markdownText(text)}`, ''); blocks.push({ text, bullet });
  };
  const link = (text: string, href: string, sources: string[]) => {
    claims.push({ text: `${text} — ${href}`, sources });
    const destination = href.replace(/[<>\\]/g, c => encodeURIComponent(c));
    lines.push(`- [${markdownText(text)}](<${destination}>)`, '');
    blocks.push({ text, href, bullet: true });
  };
  heading(p.person.name, 1, [`person:${p.person.id}`]);
  statement(p.person.headline, [`person:${p.person.id}`]);
  if (p.person.summary) statement(p.person.summary, [`person:${p.person.id}`]);
  if (p.version === 2) for (const contact of p.person.contacts ?? []) {
    const href = contact.type === 'email' ? `mailto:${encodeURIComponent(contact.value)}` : contact.type === 'phone' ? `tel:${contact.value}` : contact.value;
    link(contact.value, href, [`contact:${contact.id}`, `person:${p.person.id}`]);
  }
  heading(github ? 'Focus' : 'Skills');
  for (const skill of p.skills) statement(skill.name, [`skill:${skill.id}`], true);
  if (!github) {
    heading('Experience');
    for (const role of p.experiences) {
      statement(`${role.title} — ${role.organization} (${role.start} – ${role.end ?? 'present'})`, [`experience:${role.id}`]);
    }
  }
  heading('Selected Work');
  for (const project of p.projects) {
    heading(project.name, 3, [`project:${project.id}`]);
    statement(project.description, [`project:${project.id}`]);
    for (const a of p.achievements.filter(a => a.project === project.id)) {
      const parts = orders.get(a.id) === 'action-first' ? [a.statement.action, a.statement.problem, a.statement.outcome] : [a.statement.problem, a.statement.action, a.statement.outcome];
      statement(parts.join(' '), [`achievement:${a.id}`, `project:${project.id}`], true);
    }
  }
  if (p.version === 1 && p.openSourceContributions.length) {
    heading('Open Source');
    for (const c of p.openSourceContributions) statement(c.description, [`contribution:${c.id}`, `project:${c.project}`], true);
  } else if (p.version === 2 && p.openSourceProjects.length) {
    heading('Open Source');
    for (const project of p.openSourceProjects) {
      const source = `open-source-project:${project.id}`;
      heading(project.name, 3, [source]);
      link(`${project.name} (${project.relationship})`, project.repository, [source]);
      if (project.description) statement(project.description, [source]);
      for (const c of p.openSourceContributions.filter(c => c.openSourceProject === project.id)) {
        const text = `${c.kind} (${c.status}): ${c.description}`;
        const sources = [`contribution:${c.id}`, source];
        if (c.url) link(text, c.url, sources);
        else statement(text, sources, true);
      }
    }
  }
  if (!github && p.education.length) {
    heading('Education');
    for (const e of p.education) statement(`${e.qualification} — ${e.institution}`, [`education:${e.id}`], true);
  }
  if (p.certifications.length) {
    heading('Certifications');
    for (const c of p.certifications) statement(`${c.name} — ${c.issuer}`, [`certification:${c.id}`], true);
  }
  const env = new nunjucks.Environment(undefined, { autoescape: true });
  const html = env.renderString(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{{ title }}</title><style>body{font:11pt Arial,sans-serif;line-height:1.5;color:#17202a;max-width:760px;margin:36px auto}h1,h2,h3{break-after:avoid}p{break-inside:avoid}.bullet{margin-left:1em}@page{size:A4;margin:16mm}</style></head><body>{% for b in blocks %}{% if b.heading %}{% if b.level == 1 %}<h1>{{ b.heading }}</h1>{% elif b.level == 3 %}<h3>{{ b.heading }}</h3>{% else %}<h2>{{ b.heading }}</h2>{% endif %}{% else %}<p{% if b.bullet %} class="bullet"{% endif %}>{% if b.bullet %}• {% endif %}{% if b.href %}<a href="{{ b.href }}">{{ b.text }}</a>{% else %}{{ b.text }}{% endif %}</p>{% endif %}{% endfor %}</body></html>`, { title: p.person.name, blocks });
  return { markdown: lines.join('\n'), html, claims };
}
