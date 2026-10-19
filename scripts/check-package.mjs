import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const reuseDependencies = process.argv.includes('--reuse-dependencies');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'career-package-'));
const run = (command, args, cwd) => execFileSync(command, args, {
  cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 2_000_000,
  env: { ...process.env, npm_config_cache: join(temp, 'npm-cache'), npm_config_fetch_retries: '0', npm_config_fetch_timeout: '10000', OPENAI_API_KEY: '' },
});
async function checkLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkLinks(path);
    else if (path.endsWith('.md')) {
      const text = await readFile(path, 'utf8');
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const link = match[1].split('#')[0];
        if (link && !/^https?:/.test(link)) await stat(resolve(dirname(path), link));
      }
    }
  }
}
try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', temp], root));
  const paths = packed.files.map(file => file.path);
  for (const path of paths) assert.match(path, /^(?:dist\/src\/|src\/schema\/|docs\/|examples\/|README\.md$|CHANGELOG\.md$|LICENSE$|package\.json$)/);
  for (const required of ['dist/src/cli/index.js', 'examples/software-engineer/profile-v2.yaml', 'docs/schema.md', 'docs/privacy.md', 'src/schema/manifest.ts']) assert(paths.includes(required));
  const consumer = join(temp, 'consumer');
  await writeFile(join(temp, 'package.json'), '{"private":true}');
  const installed = join(consumer, 'node_modules', 'career-kit');
  // The explicit unpacked smoke mode cannot establish clean installation acceptance.
  if (reuseDependencies) {
    await mkdir(consumer);
    await cp(join(root, 'node_modules'), join(consumer, 'node_modules'), { recursive: true, dereference: true, filter: source => !basename(source).startsWith('.') });
    await mkdir(installed);
    run('tar', ['-xzf', join(temp, packed.filename), '-C', installed, '--strip-components=1'], temp);
  } else {
    run('npm', ['install', '--prefix', consumer, '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', join(temp, packed.filename)], temp);
  }
  const cli = join(installed, 'dist', 'src', 'cli', 'index.js');
  const career = (...args) => run(process.execPath, [cli, ...args], consumer);
  const metadata = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(career('--version').trim(), metadata.version);
  if (!reuseDependencies) assert.equal(run(join(consumer, 'node_modules', '.bin', 'career'), ['--version'], consumer).trim(), metadata.version);
  await checkLinks(join(installed, 'docs'));
  // README links are checked without scanning installed dependencies.
  const readme = await readFile(join(installed, 'README.md'), 'utf8');
  for (const match of readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) if (!/^https?:/.test(match[1])) await stat(resolve(installed, match[1]));
  career('init'); career('validate');
  for (const version of [1, 2]) {
    const profile = join(installed, 'examples', 'software-engineer', version === 1 ? 'profile.yaml' : 'profile-v2.yaml');
    career('validate', '--profile', profile);
    for (const artifact of ['cv', 'github']) assert.equal(JSON.parse(career('audit', '--profile', profile, '--artifact', artifact, '--json')).ok, true);
    const output = `output-v${version}`;
    career('build', '--profile', profile, '--output', output, '--no-pdf'); career('verify', output); career('explain', `${output}/cv.md`);
    const manifest = JSON.parse(await readFile(join(consumer, output, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.compiler, { name: metadata.name, version: metadata.version });
    for (const job of ['job.md', 'job.json']) {
      career('tailor', '--profile', profile, '--job', join(installed, 'examples', 'software-engineer', job), '--output', output, '--no-pdf');
      career('verify', output); career('explain', `${output}/cv.html`);
    }
  }
  console.log(`Packed package ${metadata.name}@${metadata.version}: ${reuseDependencies ? "unpacked runtime smoke with reused dependencies" : "clean isolated install"}, commands, contracts and links passed (${packed.entryCount} files).`);
} finally { await rm(temp, { recursive: true, force: true }); }
