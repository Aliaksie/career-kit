import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { auditArtifactSchema, auditSchema, type Audit } from '../schema/audit.js';
import type { Profile } from '../schema/profile.js';
import { decideDisclosure, disclosedSources, type DisclosureDecision } from './disclosure.js';
import { validateProfile } from './profile.js';

export function auditFailure(code: Audit['errors'][number]['code'], artifact?: 'cv' | 'github'): Audit {
  return auditSchema.parse({ version: 1, ok: false, ...(artifact ? { artifact } : {}), records: [], errors: [{ code }] });
}
export function auditDecision(artifact: 'cv' | 'github', decision: DisclosureDecision): Audit {
  const expected = decision.records.filter(r => r.decision === 'included').map(r => r.source).sort();
  const actual = disclosedSources(decision.profile).sort();
  if (expected.length !== actual.length || expected.some((source, index) => source !== actual[index])) return auditFailure('POLICY_VIOLATION', artifact);
  return auditSchema.parse({ version: 1, ok: true, artifact, records: decision.records, errors: [] });
}
export function auditProfile(p: Profile, artifact: 'cv' | 'github'): Audit {
  return auditDecision(artifact, decideDisclosure(p, artifact));
}
export async function auditFile(path: string, requestedArtifact: unknown): Promise<Audit> {
  const selection = auditArtifactSchema.safeParse(requestedArtifact);
  if (!selection.success) return auditFailure('INVALID_ARTIFACT');
  const artifact = selection.data;
  let bytes: string;
  try { bytes = await readFile(path, 'utf8'); }
  catch { return auditFailure('INPUT_UNREADABLE', artifact); }
  let profile: Profile;
  try {
    const input: unknown = parse(bytes);
    if (input && typeof input === 'object' && 'version' in input && input.version !== 1 && input.version !== 2) return auditFailure('UNSUPPORTED_PROFILE_VERSION', artifact);
    profile = validateProfile(input);
  } catch { return auditFailure('INVALID_PROFILE', artifact); }
  try { return auditProfile(profile, artifact); }
  catch { return auditFailure('INTERNAL_ERROR', artifact); }
}
