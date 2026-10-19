# Consumer contract — current compiler

Applies to package `career-kit@0.1.0`, profile schema 1 and provenance schema 1, inspected at engine base `3bb9b73`. Local test-timeout changes do not affect this interface. This document describes implementation, not a published release. Proposed v2 data is in [domain decisions](decisions/README.md); planned manifest/audit behavior is in the [bundle contract](manifest-audit-contract.md).

## Installation and inputs

Runtime is Node.js 24+; source development uses pnpm 10.34.5 and the frozen lockfile. An installed package exposes `career`; source-checkout examples below use `node dist/src/cli/index.js` after `pnpm build`. PDF requires the Chromium revision matching the installed Playwright dependency, installed with `pnpm exec playwright install --with-deps chromium`. Existing clean network install, PDF and hosted checks remain separate acceptance gates.

One UTF-8 YAML file contains facts and embedded targets. No directory loading, config discovery, overlays, contact sidecars, evidence files or environment-based input discovery exists. Relative profile/job/output/artifact paths resolve from the caller's current working directory. `init` locates its fictional template relative to its own module, independently of the working directory.

Schema validation rejects unknown fields, unsupported versions, malformed IDs/dates, duplicate IDs/targets, broken references and end-before-start employment periods. IDs are globally unique across person, skills, experiences, projects, achievements, education, certifications and contributions. Unknown target names fail; `generic` is a default name, not an automatically created target.

Person and entities require visibility and a disclosure mapping. Missing artifact flags deny access; private visibility always excludes. Withheld experiences exclude their projects; withheld projects exclude achievements/contributions; withheld skills exclude achievements referencing them. `sanitized` means the author already sanitized the text. Generic bundles require the person to permit both CV and GitHub; tailoring requires CV permission only. Portfolio permission is schema data; no portfolio renderer exists.

## Commands and machine behavior

| Command | Inputs/options/defaults | Result |
| --- | --- | --- |
| `init` | `-p, --profile <file>` = `profile.yaml` | Writes fictional YAML with exclusive creation; existing file is preserved. Parent directories are not created. |
| `validate` | `-p, --profile <file>` = `profile.yaml` | Validates schema/references; writes no outputs. |
| `build` | profile as above; `-t, --target <name>` = `generic`; `-o, --output <directory>` = `generated`; `--no-pdf` | Generic CV and GitHub bundle. PDF is on unless disabled. |
| `tailor` | profile/target as above; required `--job <file>`; output = `generated/tailored`; `--no-pdf`; optional `--polish <provider>`, `--model <name>` | CV-only bundle and matching report. |
| `explain <artifact>` | Explicit artifact path; adjacent `<artifact>.claims.json` | Verifies digest and strict sidecar schema, then prints coverage/claims/sources. |

Successful commands exit 0. CLI validation/application failures and invalid option combinations exit 1 with a human-readable diagnostic on stderr. Other nonzero termination, including process/browser/OS failure, is failure. Consumers branch on zero versus nonzero; diagnostic text is not a stable API. There is currently no structured validation diagnostic or `audit` command. `--help`/`--version` exit 0; current CLI version is hardcoded `0.1.0`. Future releases must align it with package metadata.

`--polish` accepts only `openai` and requires an explicit model; `--model` requires polishing. The opt-in reads `OPENAI_API_KEY`. Absent credentials fail rather than falling back. Offline examples below do not contact a provider. The provider receives only selected CV achievement IDs and complete statements, with bounded extractive ordering; it cannot add claims. Person/job/evidence/contact data are not provider inputs.

## Worked generic and tailored examples

From the engine checkout, after compilation:

```sh
node dist/src/cli/index.js validate --profile examples/software-engineer/profile.yaml
node dist/src/cli/index.js build --profile examples/software-engineer/profile.yaml --target generic --output /tmp/career-contract/generic --no-pdf
node dist/src/cli/index.js explain /tmp/career-contract/generic/cv.md
node dist/src/cli/index.js tailor --profile examples/software-engineer/profile.yaml --job examples/software-engineer/job.md --target generic --output /tmp/career-contract/tailored --no-pdf
node dist/src/cli/index.js explain /tmp/career-contract/tailored/cv.md
node dist/src/cli/index.js tailor --profile examples/software-engineer/profile.yaml --job examples/software-engineer/job.json --target generic --output /tmp/career-contract/structured --no-pdf
node dist/src/cli/index.js explain /tmp/career-contract/structured/cv.html
```

Each output directory contains the inventory in the [artifact contract](artifact-contract.md). Omit `--no-pdf` only with working matching Chromium. These examples use fictional input and no keys.

`.json` job filenames (case-insensitive suffix) select strict JSON requirements; other suffixes select the Markdown/plain-text keyword heuristic. Input length is 1–100000 JavaScript string characters. JSON requires 1–100 unique requirements, each with `id`, `label`, 1–20 nonempty `terms`, and `importance: required|preferred`; labels/terms are at most 500 characters. Terms within one requirement are alternatives; separate requirements express separate needs. Unknown terms stay unmatched. Heuristic extraction has limited negation and importance handling; unrecognized requirement-like lines appear in `unparsed`, but a partly recognized line can still hide constraints. Zero recognized requirements rejects text input.

Generic selection ranks achievements by configured metadata priorities with ID ties. `maxAchievements` caps the total; `experience.maxBulletsPerRole` actually caps per experience (or per project when no experience exists). Generic builds retain other disclosed facts even when no achievement is selected. Tailoring matches only disclosed achievement metadata (skills, roles, domains, tags), ranks required/preferred matches, then target priorities and IDs, and removes unrelated projects, experiences, skills and project-linked contributions. Disclosed education/certifications remain. Matching reports distinguish all matching achievements from the subset selected under limits. No job suitability or productivity score is promised.

## Version boundaries

Pin an exact package identity and lockfile; package version alone does not prove publication or hosted success. Profile, provenance and future manifest versions are independent. Current readers accept profile/provenance version 1 only. Unknown versions fail, rather than being guessed. No public stable provider/plugin API is declared. Pre-1.0 breaking changes require explicit release/migration notes and readers/guidance before private migration; retain the prior profile revision and compatible package pin for rollback.

The current package file allowlist excludes `docs/`. These checkout documents do not yet satisfy the packaged documentation requirement; S6 must include them or supply stable versioned links.
