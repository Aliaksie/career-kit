# Consumer contract

Requires Node.js 24+. Pin an exact engine version and lockfile. Source development uses pnpm 10.34.5; PDF requires Chromium matching the installed Playwright dependency. See the [README](../README.md) for runnable examples.

## Inputs and commands

One YAML file contains facts and targets. Relative paths resolve from the caller’s working directory. No config discovery, split profiles or evidence/contact sidecar loading exists. Supported profile versions are 1 and 2; provenance remains version 1; unknown versions and fields fail validation.

| Command | Defaults and result |
| --- | --- |
| `init` | `--profile profile.yaml`; creates fictional input without overwriting. |
| `validate` | `--profile profile.yaml`; checks schema, global IDs and references. |
| `build` | `--profile profile.yaml --target generic --output generated`; CV and GitHub bundle. |
| `tailor --job <file>` | Same profile/target defaults; `--output generated/tailored`; CV-only bundle. |
| `audit --artifact <cv\|github> [--json]` | Same profile default; redacted source-disclosure report before selection. |
| `verify <directory>` | Validates manifest v1, complete inventory, digests and sidecar/report semantics. |
| `explain <artifact>` | Checks adjacent sidecar schema and document digest; prints claims/sources. |

Build/tailor produce PDF unless `--no-pdf` is supplied. A case-insensitive `.json` job suffix selects structured requirements; other suffixes use keyword extraction. See the fictional [JSON job](../examples/software-engineer/job.json). Unknown requirements remain unmatched; heuristic extraction can miss constraints. `experience.maxBulletsPerRole` limits achievements per experience, or per project without an experience.

Success exits 0; failure is nonzero. Diagnostics are human-readable, except the versioned [audit JSON interface](privacy.md). Optional `--polish openai --model <name>` requires `OPENAI_API_KEY`; only selected disclosed achievement statements/IDs enter the provider. No key is needed offline.

## Compatibility

Profile and artifact schema versions are independent of package versions. Pre-1.0 breaking changes require release notes and migration guidance before consumers change input. Retain the previous profile revision and package pin for rollback. The internal provider interface is not a stable public extension API.

The [artifact contract](artifact-contract.md) defines output handling. Domain decisions are in [decisions](decisions/README.md). Consumer docs, runtime declarations and schema sources ship with the package. See [delivery and compatibility](delivery.md).
