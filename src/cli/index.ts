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
import { OpenAIProvider } from '../llm/openai.js';

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
program.command('build').description('Build deterministic content; PDF bytes may contain browser metadata').option('-p, --profile <file>', 'profile file', 'profile.yaml').option('-t, --target <name>', 'target name', 'generic').option('-o, --output <directory>', 'output directory', 'generated').option('--no-pdf', 'skip PDF when Chromium is unavailable').action(async opts => {
  await build(await loadProfile(opts.profile), opts.target, opts.output, opts.pdf); console.log(`Built artifacts in ${opts.output}`);
});
program.command('tailor').description('Match a job to disclosed evidence and generate a tailored CV')
  .requiredOption('--job <file>', 'Markdown/text job, or structured JSON requirements')
  .option('-p, --profile <file>', 'profile file', 'profile.yaml')
  .option('-t, --target <name>', 'target limits and tie-breaking priorities', 'generic')
  .option('-o, --output <directory>', 'output directory', 'generated/tailored')
  .option('--no-pdf', 'skip PDF when Chromium is unavailable')
  .option('--polish <provider>', 'opt in to source-clause ordering via OpenAI')
  .option('--model <name>', 'explicit OpenAI model supporting structured outputs')
  .action(async opts => {
    if (opts.polish && opts.polish !== 'openai') throw new Error('Only the openai polishing provider is supported');
    if (opts.polish && !opts.model) throw new Error('--model is required with --polish openai');
    if (opts.model && !opts.polish) throw new Error('--model requires --polish openai');
    const model = opts.polish ? new OpenAIProvider(process.env.OPENAI_API_KEY ?? '', opts.model) : undefined;
    await tailor(await loadProfile(opts.profile), await readFile(opts.job, 'utf8'), opts.output, {
      target: opts.target, structured: opts.job.toLowerCase().endsWith('.json'), pdf: opts.pdf, model,
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
