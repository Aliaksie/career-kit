import { z } from 'zod';
export const auditArtifactSchema = z.enum(['cv', 'github']);
export const auditErrorSchema = z.enum(['INPUT_UNREADABLE', 'INVALID_PROFILE', 'UNSUPPORTED_PROFILE_VERSION', 'INVALID_ARTIFACT', 'INTERNAL_ERROR', 'POLICY_VIOLATION']);
export const auditRecordSchema = z.strictObject({
  source: z.string().regex(/^(person|contact|skill|experience|project|achievement|education|certification|open-source-project|contribution):[a-z0-9][a-z0-9-]*$/),
  decision: z.enum(['included', 'excluded']),
  reason: z.enum(['allowed', 'private', 'not-disclosed', 'parent-excluded', 'skill-excluded']),
}).refine(r => (r.decision === 'included') === (r.reason === 'allowed'), 'Inconsistent disclosure decision');
export const auditSchema = z.strictObject({
  version: z.literal(1), ok: z.boolean(), artifact: auditArtifactSchema.optional(),
  records: z.array(auditRecordSchema), errors: z.array(z.strictObject({ code: auditErrorSchema })),
}).refine(r => r.ok ? Boolean(r.artifact) && r.errors.length === 0 : r.errors.length > 0, 'Inconsistent audit result');
export type AuditRecord = z.infer<typeof auditRecordSchema>;
export type Audit = z.infer<typeof auditSchema>;
