import { loadPrompt } from '../llm/prompts.js';
import { disclose } from './profile.js';
import type { Profile } from '../schema/profile.js';
import { polishSchema, type AchievementOrder } from '../schema/polish.js';
import type { LanguageModel } from '../llm/provider.js';

export async function polish(p: Profile, model: LanguageModel): Promise<ReadonlyMap<string, AchievementOrder>> {
  p = disclose(p, 'cv');
  if (p.achievements.length === 0) return new Map();
  if (p.achievements.length > 50) throw new Error('Polishing supports at most 50 selected achievements');
  const prompt = await loadPrompt('clause-order');
  const output = polishSchema.parse(await model.generate({
    name: 'career_clause_order', schema: polishSchema,
    instructions: prompt.system, user: prompt.user, parameters: prompt.parameters,
    // Person, employment, private evidence sidecars and the job description are intentionally absent.
    input: { achievements: p.achievements.map(a => ({ id: a.id, statement: a.statement })) },
  }));
  const expected = new Set(p.achievements.map(a => a.id));
  const orders = new Map<string, AchievementOrder>();
  for (const a of output.achievements) {
    if (!expected.has(a.id) || orders.has(a.id)) throw new Error('Polishing returned an unknown or duplicate achievement ID');
    orders.set(a.id, a.order);
  }
  if (orders.size !== expected.size) throw new Error('Polishing omitted selected achievement IDs');
  return orders;
}
