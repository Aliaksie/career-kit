import type { Profile } from '../schema/profile.js';
import type { LanguageModel } from '../llm/provider.js';
import { matchJob } from './matching/match.js';
import { optionalEditCV } from './edit-cv.js';
import { loadTemplates } from '../renderers/templates.js';
import { compose } from '../renderers/documents.js';
import { writeArtifacts } from './build.js';

export async function tailor(profile: Profile, job: string, output: string, options: {
  target?: string; structured?: boolean; pdf?: boolean; model?: LanguageModel; templateDirectory?: string;
} = {}): Promise<void> {
  const target = options.target ?? 'generic';
  const result = matchJob(profile, job, target, options.structured);
  const edited = await optionalEditCV(result.profile, options.model, result.report.coverage.map(c => c.requirement));
  if (edited.metadata) result.report.polishing = { ...edited.metadata, promptVersion: 'tailor-cv-v1' };
  const document = compose(edited.profile, false, edited.orders, loadTemplates(options.templateDirectory));
  await writeArtifacts(profile, document, output, `job:${target}`, options.pdf ?? true, undefined, result.report);
}
