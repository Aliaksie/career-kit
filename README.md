# Career Kit

An evidence-grounded career profile compiler. Maintain facts in YAML and generate a CV and GitHub README from the same source. Validation, compilation and job tailoring run offline after installation. Optional OpenAI support only orders complete source clauses; it does not rewrite facts.

Requires Node.js 24+. Source development uses pnpm 10.34.5. PDF requires Chromium matching the installed Playwright version.

## Quick start

From a source checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
node dist/src/cli/index.js init
node dist/src/cli/index.js validate
node dist/src/cli/index.js audit --artifact github --json
node dist/src/cli/index.js build --target generic --no-pdf
node dist/src/cli/index.js verify generated
node dist/src/cli/index.js explain generated/cv.md
```

For PDF, run `pnpm exec playwright install chromium` and omit `--no-pdf`. To test a distributable locally, run `npm pack` after building and install the resulting tarball in a separate consumer with `npm install --save-exact /absolute/path/to/career-kit-0.2.0.tgz`; use `npx career` there. Version metadata alone is not evidence of a published release. Source development can use `pnpm career`.

The [v1 starter](examples/software-engineer/profile.yaml) and [v2 example](examples/software-engineer/profile-v2.yaml) are fictional. Store personal profiles in a private consumer repository, outside the compiler checkout. Generated files and root `profile.yaml` are ignored.

## Commands and output

| Command | Purpose |
| --- | --- |
| `init` | Create a fictional profile without overwriting. |
| `validate` | Check profile schema, global IDs and references. |
| `build` | Compile a target into CV and GitHub artifacts. |
| `tailor --job <file>` | Build a CV-only bundle using offline matching. |
| `audit --artifact cv\|github [--json]` | Report source-disclosure IDs/reasons before selection. |
| `verify <directory>` | Check complete bundle inventory, digests and sidecar/report semantics. |
| `explain <artifact>` | Verify one document and show its claim attribution. |

Input commands accept `--profile <file>` (default `profile.yaml`). Build/tailor accept `--target generic`, `--output <directory>` and `--no-pdf`. See the [consumer contract](docs/consumer-contract.md) for defaults and exit behavior.

Build writes `cv.md`, `cv.html`, optional `cv.pdf`, `github-readme.md`, document `.claims.json` sidecars and manifest v1. Tailor omits GitHub output and adds `matching.json`. Text/HTML and manifests are deterministic for identical inputs/configuration; Chromium PDF metadata can vary. Managed outputs are replaced under a completion-marker protocol; unrelated files survive. See [artifact handling and recovery](docs/artifact-contract.md) and [provenance](docs/provenance.md).

## Privacy and evidence

Every fact has visibility and artifact permissions. Private always denies; omitted flags deny; sanitized means the supplied text was already sanitized by its author. Parent exclusions propagate before rendering. Contacts require independent permissions, including when their person is disclosed. Only selected CV achievement IDs/statements may enter optional provider requests. Evidence/contact sidecars are never loaded automatically.

Before publishing, audit the exact source, rebuild, verify the bundle and review the output diff and destination. Audit reports omit contact values/descriptions but IDs remain potentially sensitive. Digests establish integrity, not factual truth, authorship or permission to publish. Read [privacy and audit](docs/privacy.md) before enabling publication.

## Profile and tailoring

[Schema guidance](docs/schema.md) covers v1/v2, independent open-source work, contacts, global IDs, chronology and explicit migration/rollback. V1 remains supported; `init` creates v1. No private profile is migrated automatically.

```sh
node dist/src/cli/index.js tailor \
  --profile examples/software-engineer/profile-v2.yaml \
  --job examples/software-engineer/job.md \
  --target generic --output generated/tailored --no-pdf
node dist/src/cli/index.js verify generated/tailored
```

Markdown/text keyword extraction is heuristic; strict [JSON requirements](examples/software-engineer/job.json) provide a more explicit alternative. Unmatched requirements remain visible. No API key is needed. [Tailoring guidance](docs/tailoring.md) describes limitations and explicit OpenAI opt-in.

## Development and direction

Run `pnpm check`. Hosted CI also installs matching Chromium, checks generic/tailored PDFs, audits fictional v1/v2 inputs and tests the packed package in an isolated consumer. See [architecture](docs/architecture.md), [domain decisions](docs/decisions/README.md) and [delivery/compatibility](docs/delivery.md).

The compiler keeps offline composition, explicit disclosure, factual clauses and source attribution central. Reviewed imports, authoring tools, configurable templates, portfolio output and stable extension contracts are future work. Free-form rewriting, career scoring, automatic fact invention and automatic publication are outside the current contract.

## Presentation templates

CV and GitHub use separate layouts with grouped skills, employer-owned assignments and compact open-source summaries. Consumers can supply a trusted template pack with `--templates <directory>` to both build and tailor while retaining disclosure, matching, PDF, provenance and bundle verification. See [templates and presentation](docs/templates.md) for the view contract, content budgets and migration notes.
