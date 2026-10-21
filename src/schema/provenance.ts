import { z } from 'zod';
import { tailoringSchema } from './job.js';
export const provenanceSchema = z.strictObject({
  version: z.literal(1), target: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  tailoring: tailoringSchema.optional(),
  polishing: z.strictObject({ provider: z.string(), model: z.string(), promptVersion: z.literal('polish-cv-v1'), reviewRequired: z.literal(true) }).optional(),
  claims: z.array(z.strictObject({ text: z.string(), sources: z.array(z.string()).min(1) })),
});
