import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { z } from 'zod';

const metadata = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/), version: z.number().int().positive(),
  description: z.string().trim().min(1),
  parameters: z.strictObject({ maxTokens: z.number().int().min(256).max(8192), temperature: z.number().min(0).max(1).optional() }),
});
export function parsePrompt(source: string) {
  const parts = /^---\r?\n([\s\S]*?)\r?\n---\r?\nsystem:\r?\n([\s\S]*?)\r?\nuser:\r?\n([\s\S]+)$/.exec(source);
  if (!parts) throw new Error('Invalid prompt document');
  const header = metadata.parse(parse(parts[1]));
  const system = parts[2].trim();
  const user = parts[3].trim();
  if (!system || !user) throw new Error('Prompt sections must not be empty');
  return { ...header, system, user, identity: `${header.name}-v${header.version}` };
}
export async function loadPrompt(name: 'clause-order' | 'polish-cv' | 'tailor-cv') {
  let source: string;
  try { source = await readFile(new URL(`../../prompts/${name}.md`, import.meta.url), 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    source = await readFile(new URL(`../../../prompts/${name}.md`, import.meta.url), 'utf8');
  }
  const prompt = parsePrompt(source);
  if (prompt.name !== name) throw new Error('Prompt identity does not match its file');
  return prompt;
}
