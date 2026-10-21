import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { optionalEditCV, type EditingMetadata } from './edit-cv.js';
import type { LanguageModel } from '../llm/provider.js';
import { disclose, select, profileDigest } from './profile.js';
import { compose, type Document } from '../renderers/documents.js';
import type { Profile } from '../schema/profile.js';
import type { Tailoring } from '../schema/job.js';

import { compilerIdentity, sha256 as hash } from './metadata.js';
import { loadTemplates } from '../renderers/templates.js';
import { publishBundle } from './bundle.js';
import type { Manifest } from '../schema/manifest.js';
export async function build(p: Profile, targetName: string, output: string, pdf = true, templateDirectory?: string, model?: LanguageModel): Promise<void> {
  const target = p.targets.find(t => t.name === targetName);
  if (!target) throw new Error(`Unknown target: ${targetName}`);
  // Both disclosure checks precede filesystem effects.
  const cvProfile = select(disclose(p, 'cv'), target);
  const githubProfile = select(disclose(p, 'github'), target, undefined, 'github');
  const templates = loadTemplates(templateDirectory);
  const edited = await optionalEditCV(cvProfile, model);
  const cv = compose(edited.profile, false, edited.orders, templates);
  const github = compose(githubProfile, true, undefined, templates);
  await writeArtifacts(p, cv, output, targetName, pdf, github, undefined, edited.metadata);
}
export async function writeArtifacts(profile: Profile, cv: Document, output: string, targetName: string, pdf: boolean, github?: Document, tailoring?: Tailoring, polishing?: EditingMetadata): Promise<void> {
  let pdfBytes: Buffer | undefined;
  if (pdf) {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ javaScriptEnabled: false });
      // No remote resources or local file URLs may be loaded by a renderer.
      await page.route('**/*', route => route.abort());
      await page.setContent(cv.html, { waitUntil: 'load' });
      pdfBytes = await page.pdf({ format: 'A4', printBackground: true });
    } finally { await browser.close(); }
  }
  const files: Record<string, string | Buffer> = { 'cv.md': cv.markdown, 'cv.html': cv.html };
  if (github) files['github-readme.md'] = github.markdown;
  if (pdfBytes) files['cv.pdf'] = pdfBytes;
  const manifest: Manifest = {
    version: 1, compiler: await compilerIdentity(), profileSchemaVersion: profile.version,
    profileSha256: profileDigest(profile), kind: tailoring ? 'tailor' : 'build',
    target: tailoring ? targetName.slice(4) : targetName, artifacts: [],
  };
  const bundle = new Map<string, string | Buffer>();
  if (tailoring) {
    const report = JSON.stringify(tailoring, null, 2) + '\n';
    bundle.set('matching.json', report);
    manifest.report = { path: 'matching.json', sha256: hash(report) };
  }
  for (const [name, contents] of Object.entries(files)) {
    const path = name as Manifest['artifacts'][number]['path'];
    const provenance = JSON.stringify({ version: 1, target: targetName, sha256: hash(contents), claims: name === 'cv.md' ? cv.claims : name.startsWith('cv.') ? cv.htmlClaims : github!.claims, ...(tailoring ? { tailoring } : {}), ...(polishing && name.startsWith('cv.') ? { polishing } : {}) }, null, 2) + '\n';
    bundle.set(path, contents); bundle.set(`${path}.claims.json`, provenance);
    manifest.artifacts.push({ path, format: path.endsWith('.md') ? 'markdown' : path.endsWith('.html') ? 'html' : 'pdf', sha256: hash(contents), provenance: { path: `${path}.claims.json`, version: 1, sha256: hash(provenance) } });
  }
  await publishBundle(output, bundle, manifest);
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
