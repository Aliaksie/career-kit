import { z } from 'zod';
import { disclose, validateProfile } from './profile.js';
import type { Profile } from '../schema/profile.js';
import { requirementSchema, type Requirement } from '../schema/job.js';
import { achievementOrderSchema, type AchievementOrder } from '../schema/polish.js';
import type { LanguageModel } from '../llm/provider.js';
import { loadPrompt } from '../llm/prompts.js';

const clause = z.string().trim().min(1).max(4000).refine(s => ![...s].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127), 'Control characters are not allowed');
const statement = z.strictObject({ problem: clause, action: clause, outcome: clause });
const outputSchema = z.strictObject({ achievements: z.array(z.strictObject({
  id: z.string().min(1).max(200), statement, order: achievementOrderSchema,
})).max(50) });
const keys = ['problem', 'action', 'outcome'] as const;
// Conservative tripwires, not a semantic proof. Keep limitations and attribution verbatim.
const protectedPattern = /\b(?:no|not|never|without|only|approximately|about|up to|at least|at most|estimated|potential|pilot|prototype|experimental|unmeasured|unverified|proposed|planned|contributed|co-designed|co-led|assisted|helped|supported|collaborated|team|jointly)\b/gi;
const quantities = (s: string) => [...s.matchAll(/(?:[$€£]\s*)?\d+(?:[.,]\d+)*(?:\s*(?:%|ms\b|seconds?\b|minutes?\b|hours?\b|days?\b|weeks?\b|months?\b|years?\b|users?\b|requests?\b|million\b|billion\b|[kKmMbB]\b))?/g)].map(m => m[0]);
const words = (s: string) => (s.match(/[\p{L}\p{N}+#.%-]+/gu) ?? []).map(w => w.replace(/\.+$/, '')).filter(Boolean);
function containsPhrase(text: string, phrase: string): boolean {
  const haystack = words(text.toLowerCase());
  const needle = words(phrase.toLowerCase());
  return haystack.some((_, i) => needle.every((w, j) => haystack[i + j] === w));
}
function protectedPhrases(text: string, skills: string[]): string[] {
  return [...new Set([
    ...quantities(text), ...[...text.matchAll(protectedPattern)].map(m => m[0]),
    // Preserve complete sentences containing limitations or attribution conservatively.
    ...text.split(/(?<=[.!?])\s+/).filter(sentence => new RegExp(protectedPattern.source, 'i').test(sentence)),
    ...skills.filter(s => containsPhrase(text, s)),
    ...words(text).filter(w => /[A-Z].*[A-Z]|[a-z][A-Z]|[+#]/.test(w)),
  ])];
}
export type EditingMetadata = { provider: string; model: string; promptVersion: string; reviewRequired: true };
export async function editCV(profile: Profile, model: LanguageModel, requirements?: Requirement[]): Promise<{
  profile: Profile; orders: ReadonlyMap<string, AchievementOrder>; metadata?: EditingMetadata;
}> {
  const p = disclose(profile, 'cv');
  if (!p.achievements.length) return { profile: p, orders: new Map() };
  if (p.achievements.length > 50) throw new Error('Polishing supports at most 50 selected achievements');
  if (requirements !== undefined) requirements = z.array(requirementSchema).max(100).parse(requirements);
  const skills = p.skills.map(s => s.name);
  const achievements = p.achievements.map(a => ({
    id: a.id, statement: statement.parse(a.statement),
    protected: Object.fromEntries(keys.map(k => [k, protectedPhrases(a.statement[k], skills)])),
  }));
  // The explicit allowlist excludes person, contacts, employers and private sidecars.
  const input = { achievements, ...(requirements === undefined ? {} : { requirements }) };
  if (Buffer.byteLength(JSON.stringify(input)) > 64_000) throw new Error('Polishing input exceeds 64000 bytes');
  const prompt = await loadPrompt(requirements === undefined ? 'polish-cv' : 'tailor-cv');
  const result = outputSchema.parse(await model.generate({
    name: 'career_cv_edit', instructions: prompt.system, user: prompt.user,
    parameters: prompt.parameters, input, schema: outputSchema,
  }));
  if (result.achievements.length !== achievements.length) throw new Error('Polishing changed selected IDs');
  const orders = new Map<string, AchievementOrder>();
  const edited = result.achievements.map((candidate, index) => {
    const source = achievements[index];
    if (candidate.id !== source.id) throw new Error('Polishing changed ID order or membership');
    for (const key of keys) {
      const before = source.statement[key];
      const after = candidate.statement[key];
      if (after.length > Math.max(300, before.length * 2)) throw new Error('Polishing expanded a clause excessively');
      if (JSON.stringify(quantities(before)) !== JSON.stringify(quantities(after))) throw new Error('Polishing changed quantities');
      if (source.protected[key].some(phrase => !containsPhrase(after, phrase))) throw new Error('Polishing removed protected evidence');
      if (/https?:|www\.|[<>]/i.test(after) && after !== before) throw new Error('Polishing introduced markup or a link');
      // A job requirement must never supply a new known skill to a candidate claim.
      const terms = [...skills, ...(requirements?.flatMap(r => r.terms) ?? [])];
      if (terms.some(term => containsPhrase(after, term) && !containsPhrase(before, term))) throw new Error('Polishing introduced a requirement or skill');
    }
    orders.set(candidate.id, candidate.order);
    return { ...p.achievements[index], statement: candidate.statement };
  });
  return {
    profile: validateProfile({ ...p, achievements: edited }), orders,
    metadata: { ...model.identity, promptVersion: prompt.identity, reviewRequired: true },
  };
}

export async function optionalEditCV(profile: Profile, model?: LanguageModel, requirements?: Requirement[]) {
  if (!model) return { profile, orders: undefined, metadata: undefined };
  try { return await editCV(profile, model, requirements); }
  catch {
    console.warn('AI polishing failed; using the deterministic CV.');
    return { profile, orders: undefined, metadata: undefined };
  }
}
