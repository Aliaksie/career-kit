#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadProfile } from '../application/profile.js';
import { build, explain } from '../application/build.js';

const program = new Command().name('career').description('Compile evidence-grounded career profiles').version('0.1.0');
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
program.command('explain <artifact>').description('Show source references for an unchanged generated artifact').action(async path => { console.log(await explain(path)); });
try { await program.parseAsync(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
