#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadProfile } from '../application/profile.js';
import { build, explain } from '../application/build.js';
import { tailor } from '../application/tailor.js';
import { auditFile, auditFailure } from '../application/audit.js';
import type { Audit } from '../schema/audit.js';
import { verifyBundle } from '../application/bundle.js';
import { compilerIdentity } from '../application/metadata.js';

function polishingOptions(command: Command): Command {
  return command.option('--polish <provider>', 'opt in to AI wording edits: openai, anthropic, google, openai-compatible')
    .option('--model <name>', 'explicit model supporting structured outputs')
    .option('--endpoint <url>', 'provider API base URL; required for openai-compatible')
    .option('--api-key-env <name>', 'environment variable containing the provider API key');
}
async function configuredModel(opts: { polish?: string; model?: string; endpoint?: string; apiKeyEnv?: string }) {
  if (opts.polish && !opts.model) throw new Error('--model is required with --polish');
  if (!opts.polish && (opts.model || opts.endpoint || opts.apiKeyEnv)) throw new Error('--model, --endpoint and --api-key-env require --polish');
  return opts.polish ? (await import('../llm/sdk.js')).createLanguageModel({ provider: opts.polish, model: opts.model!,
    endpoint: opts.endpoint, apiKeyEnv: opts.apiKeyEnv }) : undefined;
}

const isAudit = process.argv[2] === 'audit';
const auditJson = isAudit && process.argv.slice(3).includes('--json');
function printAudit(result: Audit): void {
  if (auditJson) console.log(JSON.stringify(result));
  else if (result.ok) console.log(result.records.map(r => `${r.source}: ${r.decision} (${r.reason})`).join('\n'));
  else console.error(result.errors.map(e => e.code).join('\n'));
  if (!result.ok) process.exitCode = 1;
}
const program = new Command().name('career').description('Compile evidence-grounded career profiles').version((await compilerIdentity()).version);
if (isAudit) program.exitOverride().configureOutput({ writeErr: () => {} });
program.command('audit').description('Report source disclosure decisions without private values')
  .option('-p, --profile <file>', 'profile file', 'profile.yaml')
  .option('--artifact <artifact>', 'cv or github')
  .option('--json', 'emit versioned redacted JSON')
  .allowExcessArguments(false)
  .action(async opts => { printAudit(await auditFile(opts.profile, opts.artifact)); });
program.command('init').description('Create a fictional example profile without overwriting files').option('-p, --profile <file>', 'profile file', 'profile.yaml').action(async opts => {
  const example = new URL('../../../examples/software-engineer/profile.yaml', import.meta.url);
  // Compiled modules have one additional directory level.
  let source: string;
  try { source = await readFile(example, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    source = await readFile(fileURLToPath(new URL('../../../../examples/software-engineer/profile.yaml', import.meta.url)), 'utf8');
  }
  await writeFile(opts.profile, source, { flag: 'wx' });
  console.log(`Created ${opts.profile}`);
});
program.command('validate').description('Validate schema and references').option('-p, --profile <file>', 'profile file', 'profile.yaml').action(async opts => {
  await loadProfile(opts.profile); console.log('Profile is valid');
});
polishingOptions(program.command('build').description('Build career content with optional CV wording edits').option('-p, --profile <file>', 'profile file', 'profile.yaml').option('-t, --target <name>', 'target name', 'generic').option('-o, --output <directory>', 'output directory', 'generated').option('--templates <directory>', 'trusted consumer template pack directory').option('--no-pdf', 'skip PDF when Chromium is unavailable')).action(async opts => {
  const model = await configuredModel(opts);
  await build(await loadProfile(opts.profile), opts.target, opts.output, opts.pdf, opts.templates, model); console.log(`Built artifacts in ${opts.output}`);
});
polishingOptions(program.command('tailor').description('Match a job to disclosed evidence and generate a tailored CV')
  .requiredOption('--job <file>', 'Markdown/text job, or structured JSON requirements')
  .option('-p, --profile <file>', 'profile file', 'profile.yaml')
  .option('-t, --target <name>', 'target limits and tie-breaking priorities', 'generic')
  .option('-o, --output <directory>', 'output directory', 'generated/tailored')
  .option('--templates <directory>', 'trusted consumer template pack directory').option('--no-pdf', 'skip PDF when Chromium is unavailable'))
  .action(async opts => {
    const model = await configuredModel(opts);
    await tailor(await loadProfile(opts.profile), await readFile(opts.job, 'utf8'), opts.output, {
      target: opts.target, structured: opts.job.toLowerCase().endsWith('.json'), pdf: opts.pdf, model, templateDirectory: opts.templates,
    });
    console.log(`Built tailored CV and matching report in ${opts.output}`);
  });
program.command('verify <directory>').description('Verify a complete manifest and every managed artifact').action(async path => { await verifyBundle(path); console.log('Bundle is valid'); });
program.command('explain <artifact>').description('Show source references for an unchanged generated artifact').action(async path => { console.log(await explain(path)); });
try { await program.parseAsync(); }
catch (error) {
  if (isAudit) {
    if (!(error instanceof CommanderError && error.exitCode === 0)) printAudit(auditFailure(error instanceof CommanderError ? 'INVALID_ARTIFACT' : 'INTERNAL_ERROR'));
  } else { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
