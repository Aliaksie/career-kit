import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { documentPaths, manifestSchema, type Manifest } from '../schema/manifest.js';
import { provenanceSchema } from '../schema/provenance.js';
import { tailoringSchema } from '../schema/job.js';
import { sha256 } from './metadata.js';

export const managedPaths = [...documentPaths.flatMap(p => [p, `${p}.claims.json`]), 'matching.json'];
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function regularBytes(path: string): Promise<Buffer> {
  // O_NOFOLLOW closes the final-component symlink race; the output directory must be consumer-owned.
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (!(await file.stat()).isFile()) throw new Error('Bundle entries must be regular files');
    return await file.readFile();
  } finally { await file.close(); }
}
export async function verifyBundle(output: string): Promise<Manifest> {
  if (!(await lstat(output)).isDirectory() || (await lstat(output)).isSymbolicLink()) throw new Error('Bundle must be a directory, not a symlink');
  const initial = await regularBytes(join(output, 'manifest.json'));
  const manifest = manifestSchema.parse(JSON.parse(initial.toString('utf8')));
  const listed = new Set<string>();
  const reportBytes = manifest.report ? await regularBytes(join(output, manifest.report.path)) : undefined;
  if (manifest.report && sha256(reportBytes!) !== manifest.report.sha256) throw new Error('Matching report digest mismatch');
  const report = reportBytes ? tailoringSchema.parse(JSON.parse(reportBytes.toString('utf8'))) : undefined;
  if (manifest.report) listed.add(manifest.report.path);
  for (const artifact of manifest.artifacts) {
    listed.add(artifact.path); listed.add(artifact.provenance.path);
    const bytes = await regularBytes(join(output, artifact.path));
    const sidecarBytes = await regularBytes(join(output, artifact.provenance.path));
    if (!bytes.length || sha256(bytes) !== artifact.sha256 || sha256(sidecarBytes) !== artifact.provenance.sha256) throw new Error('Artifact or provenance digest mismatch');
    const sidecar = provenanceSchema.parse(JSON.parse(sidecarBytes.toString('utf8')));
    if (sidecar.sha256 !== artifact.sha256 || sidecar.target !== (manifest.kind === 'tailor' ? `job:${manifest.target}` : manifest.target) || !isDeepStrictEqual(sidecar.tailoring, report)) throw new Error('Provenance metadata mismatch');
  }
  for (const path of managedPaths) if (!listed.has(path) && await exists(join(output, path))) throw new Error('Obsolete managed file in bundle');
  if (!initial.equals(await regularBytes(join(output, 'manifest.json')))) throw new Error('Bundle changed during verification');
  return manifest;
}
export async function publishBundle(output: string, files: ReadonlyMap<string, string | Buffer>, manifest: Manifest): Promise<void> {
  // Normalize parent aliases so two cooperative writers use the same sibling lock.
  const absolute = resolve(output);
  await mkdir(dirname(absolute), { recursive: true });
  const parent = await realpath(dirname(absolute));
  const destination = join(parent, basename(absolute));
  const lock = `${destination}.career-lock`;
  await mkdir(lock); // Never remove a lock we did not acquire.
  let stage: string | undefined;
  try {
    if (await exists(destination) && !(await lstat(destination)).isDirectory()) throw new Error('Output must be a directory, not a symlink');
    stage = await mkdtemp(join(parent, `.${basename(destination)}.career-stage-`));
    for (const [name, contents] of files) {
      if (!managedPaths.includes(name)) throw new Error('Unknown managed filename');
      await writeFile(join(stage, name), contents, { flag: 'wx' });
    }
    await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifestSchema.parse(manifest), null, 2) + '\n', { flag: 'wx' });
    await verifyBundle(stage);
    await mkdir(destination, { recursive: true });
    // Invalidate completion before the first managed-file mutation. Never restore it on failure.
    await rm(join(destination, 'manifest.json'), { force: true });
    for (const name of managedPaths) {
      if (files.has(name)) await rename(join(stage, name), join(destination, name));
      else await rm(join(destination, name), { force: true });
    }
    await rename(join(stage, 'manifest.json'), join(destination, 'manifest.json'));
  } finally {
    try { if (stage) await rm(stage, { recursive: true, force: true }); }
    finally { await rm(lock, { recursive: true }); }
  }
}
