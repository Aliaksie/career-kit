# Career Kit

An open-source, evidence-grounded career profile compiler. Maintain career facts in YAML and generate a CV and GitHub profile from the same evidence. v0.1 works entirely offline after installation; no LLM or API key is required.

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

The CLI supports `init`, `validate`, `build`, and `explain`. Intelligent job tailoring and OpenAI integration belong to v0.2; CV import, extended authoring, portfolio generation and plugins remain future work. No productivity scoring or automatic fact invention is included.

```sh
pnpm check
```

CI also installs Chromium, validates the fictional profile, generates the full bundle and checks the package contents. See [delivery tracking](docs/delivery.md) for scope and verification evidence.
