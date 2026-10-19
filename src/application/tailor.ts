import type { Profile } from '../schema/profile.js';
import type { LanguageModel } from '../llm/provider.js';
import { matchJob } from './matching/match.js';
import { polish } from './polish.js';
import { compose } from '../renderers/documents.js';
import { writeArtifacts } from './build.js';

export async function tailor(profile: Profile, job: string, output: string, options: {
  target?: string; structured?: boolean; pdf?: boolean; model?: LanguageModel;
} = {}): Promise<void> {
  const target = options.target ?? 'generic';
  const result = matchJob(profile, job, target, options.structured);
  const orders = options.model ? await polish(result.profile, options.model) : undefined;
  if (options.model && result.profile.achievements.length) result.report.polishing = { ...options.model.identity, promptVersion: 'source-order-v1' };
  const document = compose(result.profile, false, orders);
  await writeArtifacts(profile, document, output, `job:${target}`, options.pdf ?? true, undefined, result.report);
}
