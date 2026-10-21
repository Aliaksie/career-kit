import type { Profile } from '../schema/profile.js';
import type { LanguageModel } from '../llm/provider.js';
import { matchJob } from './matching/match.js';
import type { AchievementOrder } from '../schema/polish.js';
import { polish } from './polish.js';
import { loadTemplates } from '../renderers/templates.js';
import { compose } from '../renderers/documents.js';
import { writeArtifacts } from './build.js';

export async function tailor(profile: Profile, job: string, output: string, options: {
  target?: string; structured?: boolean; pdf?: boolean; model?: LanguageModel; templateDirectory?: string;
} = {}): Promise<void> {
  const target = options.target ?? 'generic';
  const result = matchJob(profile, job, target, options.structured);
  let orders: ReadonlyMap<string, AchievementOrder> | undefined;
  if (options.model && result.profile.achievements.length) {
    try {
      orders = await polish(result.profile, options.model);
      result.report.polishing = { ...options.model.identity, promptVersion: 'source-order-v1' };
    } catch {
      // Provider errors and invalid output keep the original source-clause order.
      console.warn('AI polishing failed; using the deterministic CV.');
    }
  }
  const document = compose(result.profile, false, orders, loadTemplates(options.templateDirectory));
  await writeArtifacts(profile, document, output, `job:${target}`, options.pdf ?? true, undefined, result.report);
}
