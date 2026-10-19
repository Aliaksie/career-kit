import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
export async function compilerIdentity(): Promise<{ name: 'career-kit'; version: string }> {
  for (const relative of ['../../package.json', '../../../package.json']) {
    let bytes: string;
    try { bytes = await readFile(new URL(relative, import.meta.url), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const data = JSON.parse(bytes);
    if (data.name !== 'career-kit' || typeof data.version !== 'string' || !data.version) throw new Error('Invalid compiler package metadata');
    return { name: 'career-kit', version: data.version };
  }
  throw new Error('Compiler package metadata missing');
}
