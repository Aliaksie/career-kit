import { z } from 'zod';
import { httpsUrl } from './url.js';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9][a-z0-9-]*$/);
export const artifactSchema = z.enum(['cv', 'github', 'portfolio']);
export type Artifact = z.infer<typeof artifactSchema>;
const disclosure = z.strictObject({ cv: z.boolean().default(false), github: z.boolean().default(false), portfolio: z.boolean().default(false) });
const fact = { id, visibility: z.enum(['public', 'sanitized', 'private']), disclosure };
const list = z.array(id).default([]);
export const targetSchema = z.strictObject({
  name: id, priorities: z.record(z.string(), z.number().min(0).max(1)).default({}),
  maxAchievements: z.number().int().positive().default(12),
  experience: z.strictObject({ maxBulletsPerRole: z.number().int().positive().default(5) }).default({ maxBulletsPerRole: 5 }),
});
const common = {
  person: z.strictObject({ ...fact, name: text, headline: text, summary: text.optional() }),
  skills: z.array(z.strictObject({ ...fact, name: text })),
  experiences: z.array(z.strictObject({ ...fact, organization: text, title: text, start: text.regex(/^\d{4}-(0[1-9]|1[0-2])$/), end: text.regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() })),
  projects: z.array(z.strictObject({ ...fact, name: text, description: text, experience: id.optional() })),
  achievements: z.array(z.strictObject({ ...fact, project: id, statement: z.strictObject({ problem: text, action: text, outcome: text }), skills: list, roles: list, domains: list, tags: list })),
  education: z.array(z.strictObject({ ...fact, institution: text, qualification: text })).default([]),
  certifications: z.array(z.strictObject({ ...fact, name: text, issuer: text })).default([]),
  targets: z.array(targetSchema).min(1),
};
const contributionFields = { ...fact, openSourceProject: id, description: text };
const contributionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...contributionFields, kind: z.literal('pr'), status: z.enum(['open', 'merged', 'closed-unmerged']), url: httpsUrl }),
  z.strictObject({ ...contributionFields, kind: z.literal('issue'), status: z.enum(['open', 'closed']), url: httpsUrl }),
  z.strictObject({ ...contributionFields, kind: z.literal('documentation'), status: z.enum(['proposed', 'completed']), url: httpsUrl.optional() }),
  z.strictObject({ ...contributionFields, kind: z.literal('maintainer'), status: z.enum(['active', 'former']), url: httpsUrl.optional() }),
  z.strictObject({ ...contributionFields, kind: z.literal('other'), status: z.enum(['proposed', 'completed']), url: httpsUrl.optional() }),
]);
export const profileSchema = z.discriminatedUnion('version', [
  z.strictObject({ ...common, version: z.literal(1), openSourceContributions: z.array(z.strictObject({ ...fact, project: id, description: text })).default([]) }),
  z.strictObject({
    ...common, version: z.literal(2),
    openSourceProjects: z.array(z.strictObject({ ...fact, name: text, repository: httpsUrl, relationship: z.enum(['upstream', 'own']), description: text.optional() })).default([]),
    openSourceContributions: z.array(contributionSchema).default([]),
  }),
]);
export type Profile = z.infer<typeof profileSchema>;
export type Target = z.infer<typeof targetSchema>;
