import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
const exec = promisify(execFile);
const cli = resolve('dist/src/cli/index.js');
// This integration scenario starts many Node processes sequentially.
it('initializes, validates, builds and explains from another working directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-cli-'));
  const run = (...args: string[]) => exec(process.execPath, [cli, ...args], { cwd: dir, env: { ...process.env, OPENAI_API_KEY: '' } });
  try {
    await run('init');
    const original = await readFile(join(dir, 'profile.yaml'), 'utf8');
    await expect(run('init')).rejects.toMatchObject({ code: 1 });
    expect(await readFile(join(dir, 'profile.yaml'), 'utf8')).toBe(original);
    await run('validate');
    await expect(run('build', '--target', 'missing', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('build', '--model', 'test', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('build', '--polish', 'openai', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await run('build', '--no-pdf');
    expect((await run('verify', 'generated')).stdout).toContain('Bundle is valid');
    expect((await run('explain', 'generated/cv.md')).stdout).toContain('achievement:reliable-processing');
    await writeFile(join(dir, 'job.md'), '- TypeScript required\n- Rust preferred');
    await run('tailor', '--job', 'job.md', '--no-pdf');
    expect((await run('explain', 'generated/tailored/cv.md')).stdout).toContain('Requirement: rust');
    const report = JSON.parse(await readFile(join(dir, 'generated/tailored/matching.json'), 'utf8'));
    expect(report.coverage).toHaveLength(2);
    await expect(run('tailor', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('tailor', '--job', 'job.md', '--model', 'example', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('tailor', '--job', 'job.md', '--endpoint', 'http://localhost:1234/v1', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('tailor', '--job', 'job.md', '--polish', 'unknown', '--model', 'test', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('tailor', '--job', 'job.md', '--polish', 'openai', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await expect(run('tailor', '--job', 'job.md', '--polish', 'openai', '--model', 'example', '--no-pdf')).rejects.toMatchObject({ code: 1 });
    await writeFile(join(dir, 'job.json'), JSON.stringify({ requirements: [{ id: 'typed', label: 'Typed code', terms: ['typescript'], importance: 'required' }] }));
    await run('tailor', '--job', 'job.json', '--no-pdf');
    expect(JSON.parse(await readFile(join(dir, 'generated/tailored/matching.json'), 'utf8')).extraction).toBe('structured');
    await expect(run('validate', '--profile', 'missing.yaml')).rejects.toMatchObject({ code: 1 });
  } finally { await rm(dir, { recursive: true, force: true }); }
}, 30_000);
