import { z } from 'zod';
export const documentPaths = ['cv.md', 'cv.html', 'cv.pdf', 'github-readme.md'] as const;
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const manifestSchema = z.strictObject({
  version: z.literal(1),
  compiler: z.strictObject({ name: z.literal('career-kit'), version: z.string().min(1) }),
  profileSchemaVersion: z.union([z.literal(1), z.literal(2)]),
  profileSha256: digest,
  kind: z.enum(['build', 'tailor']), target: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  artifacts: z.array(z.strictObject({
    path: z.enum(documentPaths), format: z.enum(['markdown', 'html', 'pdf']), sha256: digest,
    provenance: z.strictObject({ path: z.enum(['cv.md.claims.json', 'cv.html.claims.json', 'cv.pdf.claims.json', 'github-readme.md.claims.json']), version: z.literal(1), sha256: digest }),
  })).min(2).max(4),
  report: z.strictObject({ path: z.literal('matching.json'), sha256: digest }).optional(),
}).superRefine((m, ctx) => {
  const paths = m.artifacts.map(a => a.path);
  if (new Set(paths).size !== paths.length || !paths.includes('cv.md') || !paths.includes('cv.html') || paths.includes('github-readme.md') !== (m.kind === 'build') || Boolean(m.report) !== (m.kind === 'tailor')) ctx.addIssue({ code: 'custom', message: 'Invalid bundle inventory' });
  for (const a of m.artifacts) {
    if (a.provenance.path !== `${a.path}.claims.json` || a.format !== (a.path.endsWith('.md') ? 'markdown' : a.path.endsWith('.html') ? 'html' : 'pdf')) ctx.addIssue({ code: 'custom', message: 'Invalid artifact format or sidecar' });
  }
});
export type Manifest = z.infer<typeof manifestSchema>;
