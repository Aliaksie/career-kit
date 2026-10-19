import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
const exec = promisify(execFile);
const cli = resolve('dist/src/cli/index.js');
it('initializes, validates, builds and explains from another working directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-cli-'));
  const run = (...args: string[]) => exec(process.execPath, [cli, ...args], { cwd: dir });
  try {
    await run('init');
    const original = await readFile(join(dir, 'profile.yaml'), 'utf8');
    await expect(run('init')).rejects.toMatchObject({ code: 1 });
    expect(await readFile(join(dir, 'profile.yaml'), 'utf8')).toBe(original);
    await run('validate');
    await expect(run('build', '--target', 'missing', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await run('build', '--no-pdf');
    expect((await run('explain', 'generated/cv.md')).stdout).toContain('achievement:reliable-processing');
    await expect(run('validate', '--profile', 'missing.yaml')).rejects.toMatchObject({ code: 1 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
