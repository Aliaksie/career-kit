import { z } from 'zod';
export const provenanceSchema = z.strictObject({
  version: z.literal(1), target: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  claims: z.array(z.strictObject({ text: z.string(), sources: z.array(z.string()).min(1) })),
});
