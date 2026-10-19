import { z } from 'zod';
const nonempty = z.string().trim().min(1).max(500);
export const requirementSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  label: nonempty,
  terms: z.array(nonempty).min(1).max(20),
  importance: z.enum(['required', 'preferred']),
});
export const jobSchema = z.strictObject({ requirements: z.array(requirementSchema).min(1).max(100) });
export type Requirement = z.infer<typeof requirementSchema>;
export const coverageSchema = z.strictObject({
  requirement: requirementSchema,
  matched: z.array(z.string()),
  selected: z.array(z.string()),
});
export const tailoringSchema = z.strictObject({
  jobSha256: z.string().regex(/^[a-f0-9]{64}$/),
  extraction: z.enum(['keywords', 'structured']),
  unparsed: z.array(z.string()),
  coverage: z.array(coverageSchema),
});
export type Tailoring = z.infer<typeof tailoringSchema>;
