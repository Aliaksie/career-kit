import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { disclose, select } from './profile.js';
import { compose, type Document } from '../renderers/documents.js';
import type { Profile } from '../schema/profile.js';
import type { Tailoring } from '../schema/job.js';

const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
export async function build(p: Profile, targetName: string, output: string, pdf = true): Promise<void> {
  const target = p.targets.find(t => t.name === targetName);
  if (!target) throw new Error(`Unknown target: ${targetName}`);
  // Both disclosure checks precede filesystem effects.
  const cv = compose(select(disclose(p, 'cv'), target));
  const github = compose(select(disclose(p, 'github'), target), true);
  await writeArtifacts(cv, output, targetName, pdf, github);
}
export async function writeArtifacts(cv: Document, output: string, targetName: string, pdf: boolean, github?: Document, tailoring?: Tailoring): Promise<void> {
  let pdfBytes: Buffer | undefined;
  if (pdf) {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      // No remote resources or local file URLs may be loaded by a renderer.
      await page.route('**/*', route => route.abort());
      await page.setContent(cv.html, { waitUntil: 'load' });
      pdfBytes = await page.pdf({ format: 'A4', printBackground: true });
    } finally { await browser.close(); }
  }
  const files: Record<string, string | Buffer> = { 'cv.md': cv.markdown, 'cv.html': cv.html };
  if (github) files['github-readme.md'] = github.markdown;
  if (pdfBytes) files['cv.pdf'] = pdfBytes;
  await mkdir(output, { recursive: true });
  if (tailoring) await writeFile(join(output, 'matching.json'), JSON.stringify(tailoring, null, 2) + '\n');
  else await rm(join(output, 'matching.json'), { force: true });
  if (!github) {
    await rm(join(output, 'github-readme.md'), { force: true });
    await rm(join(output, 'github-readme.md.claims.json'), { force: true });
  }
  if (!pdf) {
    await rm(join(output, 'cv.pdf'), { force: true });
    await rm(join(output, 'cv.pdf.claims.json'), { force: true });
  }
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(output, name), contents);
    await writeFile(join(output, `${name}.claims.json`), JSON.stringify({ version: 1, target: targetName, sha256: hash(contents), claims: name.startsWith('cv.') ? cv.claims : github!.claims, ...(tailoring ? { tailoring } : {}) }, null, 2) + '\n');
  }
}
export async function explain(path: string): Promise<string> {
  const contents = await readFile(path);
  const record: unknown = JSON.parse(await readFile(`${path}.claims.json`, 'utf8'));
  if (!record || typeof record !== 'object' || !('sha256' in record) || record.sha256 !== hash(contents)) throw new Error('Artifact changed or provenance is invalid; rebuild it');
  const { provenanceSchema } = await import('../schema/provenance.js');
  const data = provenanceSchema.parse(record);
  const coverage = data.tailoring?.coverage.map(c => `Requirement: ${c.requirement.label} (${c.requirement.importance})\nMatched evidence: ${c.matched.length ? c.matched.join(', ') : 'none'}\nSelected evidence: ${c.selected.length ? c.selected.join(', ') : 'none'}`).join('\n\n');
  const unparsed = data.tailoring?.unparsed.length ? `Unparsed job lines (review manually):\n${data.tailoring.unparsed.join('\n')}` : '';
  const claims = data.claims.map(c => `${c.text}\nSources: ${c.sources.join(', ')}`).join('\n\n');
  return [coverage, unparsed, claims].filter(Boolean).join('\n\n');
}
