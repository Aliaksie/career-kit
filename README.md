# Career Kit

An open-source, evidence-grounded career profile compiler. Maintain career facts in YAML and generate a CV and GitHub profile from the same evidence. Compilation and deterministic job tailoring work offline after installation; no API key is required. OpenAI clause ordering is optional.

Requires Node.js 24+ and pnpm 10.34.5.

```sh
pnpm install
pnpm build
pnpm exec playwright install chromium
node dist/src/cli/index.js init
node dist/src/cli/index.js validate
node dist/src/cli/index.js build --target generic
node dist/src/cli/index.js explain generated/cv.md
```

`pnpm career` runs the source CLI during development. For a shell-level `career` command, run `npm link` after building, or install a packed release with `npm install -g ./career-kit-0.1.0.tgz` after `npm pack`.

Build creates `generated/cv.md`, `cv.html`, `cv.pdf`, and `github-readme.md`, each with a `.claims.json` provenance sidecar. Text and HTML generation are deterministic for identical input; Chromium PDF metadata can vary. Use `--no-pdf` to generate text artifacts without installing Chromium. `explain` rejects a changed artifact based on its SHA-256 digest. Sidecars provide traceability, not cryptographic proof of authorship.

All profile commands accept `--profile <file>` (default `profile.yaml`). Build also accepts `--target <name>` and `--output <directory>`. `init` never overwrites an existing file. Validation failures return a nonzero exit status.

Edit the initialized profile with your own evidence. The bundled [example](examples/software-engineer/profile.yaml) is fictional. Keep personal profiles outside this repository; the root `profile.yaml` and generated directory are ignored.

The versioned schema contains a person, skills, experiences, projects, achievements, education, certifications, open source contributions, and targets. IDs use lowercase letters, digits and hyphens and must be unique across entities. Projects may reference an experience; achievements reference a project and known skill IDs. Dates use `YYYY-MM`. Achievement statements contain `problem`, `action`, and `outcome`, rather than polished CV bullets. Unknown fields and broken references are rejected.

Every entity requires `visibility` (`public`, `sanitized`, or `private`) and a `disclosure` mapping. Missing artifact flags default to false. Private entities are always excluded. `sanitized` means **you have already sanitized the supplied text**; the compiler does not anonymize it. Disclosure filtering runs before selection and rendering. A withheld experience excludes its projects and achievements; a withheld project excludes its achievements and contributions; a withheld skill excludes achievements referencing it. The person must be disclosed for both CV and GitHub to build the complete bundle.

Targets contain a name, priorities (tag-to-weight mapping from 0 to 1), `maxAchievements`, and `experience.maxBulletsPerRole`. Ranking sums weights for unique skills, roles, domains and tags. Ties use achievement IDs; role limits apply across projects belonging to that experience. Selection controls achievements; other disclosed facts remain visible. Input order controls section order. Renderers escape source text, and PDF rendering blocks external resource requests.

The CLI supports `init`, `validate`, `build`, `tailor`, and `explain`. CV import, extended authoring, portfolio generation and plugins remain future work. No productivity scoring or automatic fact invention is included.

## Tailor a CV

```sh
node dist/src/cli/index.js tailor \
  --profile examples/software-engineer/profile.yaml \
  --job examples/software-engineer/job.md \
  --target generic --output generated/tailored --no-pdf
node dist/src/cli/index.js explain generated/tailored/cv.md
```

Tailoring writes `cv.md`, `cv.html`, optional `cv.pdf`, provenance sidecars, and `matching.json`. It generates a CV bundle, not a GitHub README. Remove `--no-pdf` with Chromium installed. Avoid reusing an output directory containing manually maintained documents: managed artifacts are replaced, and a previous PDF/GitHub README is removed when it is outside the requested bundle.

Markdown and plain-text jobs use deterministic keyword extraction from a common technology vocabulary and disclosed skill names, roles, domains and tags. Matching uses structured evidence metadata, not statements that happen to mention a job keyword. Required matches receive weight 2; preferred matches weight 1. Target priorities break score ties, then achievement IDs determine order. Target achievement and role limits still apply. Unrelated projects, roles, skills and contributions are removed; disclosed person information, education and certifications remain.

Keyword extraction is heuristic. It does not interpret proficiency, years of experience, complex negation, or every technology. Importance applies per line or required/preferred section. `unparsed` reports requirement-like lines with no recognized terms; a partly recognized line may still contain constraints the parser missed. Review coverage rather than treating it as proof of job suitability. If no keywords are recognized, the command asks for structured input.

For precise requirements, use a `.json` job, as in [the structured example](examples/software-engineer/job.json):

```json
{
  "requirements": [
    { "id": "cloud", "label": "Cloud engineering", "terms": ["aws", "azure"], "importance": "required" }
  ]
}
```

Terms within a requirement are alternatives (OR). Use separate requirements for separate capabilities. Unknown terms remain unmatched; the compiler never turns a requested capability into a career fact. `explain` shows all available matching achievement IDs and the subset selected under target limits, including gaps.

## Optional OpenAI polishing

Set `OPENAI_API_KEY` in your environment, then explicitly opt in with a model available to your account that supports structured outputs:

```sh
node dist/src/cli/index.js tailor --job ./job.md \
  --polish openai --model "YOUR_STRUCTURED_OUTPUT_MODEL" \
  --output generated/company-role --no-pdf
```

Polishing is extractive: the model chooses problem/action/outcome or action/problem/outcome order for every already-selected achievement. Every original statement remains intact. Free-form rewriting and summarization are deliberately deferred because schema validation alone cannot establish factual equivalence or preserve subtle attribution. The model cannot add claims, omit context or select different achievements. IDs, order values and complete coverage are validated before rendering or writing files.

Only selected, CV-disclosed achievement IDs and statements are sent to OpenAI. The person record, job text, unrelated achievements, private evidence files and contact sidecars are excluded. Sanitized source text remains your responsibility. Do not opt in unless those disclosed statements may be sent to the provider.

The provider uses the [Responses structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), with `store: false`, no tools or automatic retries, a 30-second request timeout, a 4096-token output budget, and limits of 50 selected achievements and 64000 input bytes. `store: false` is an API storage setting, not a promise about every provider retention policy. Refusals, incomplete responses, malformed output and HTTP failures stop generation before output changes. Sidecars record provider/model identity and prompt version. Transport and adversarial-output behavior are tested with synthetic fixtures; live model quality has not been evaluated.

```sh
pnpm check
```

CI also installs Chromium, validates the fictional profile, generates generic and tailored PDF bundles, exercises structured-job input and checks the package contents. It needs no API key or private-repository access. See [delivery tracking](docs/delivery.md) for scope and verification evidence.
