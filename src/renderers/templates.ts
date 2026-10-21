import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type Templates = { cvHtml: string; cvMarkdown: string; githubMarkdown: string };
export function loadTemplates(directory?: string): Templates {
  const bundled = new URL('../../templates/', import.meta.url);
  const root = directory ? undefined : existsSync(bundled) ? bundled : new URL('../../../templates/', import.meta.url);
  const read = (name: string) => readFileSync(directory ? resolve(directory, name) : new URL(name, root!), 'utf8');
  return { cvHtml: read('cv.html.njk'), cvMarkdown: read('cv.md.njk'), githubMarkdown: read('github.md.njk') };
}
