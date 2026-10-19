# Artifact contract

## Current inventory

| Output | Generic build | Tailor |
| --- | --- | --- |
| `cv.md`, `cv.html` | Required | Required |
| `cv.pdf` | Unless `--no-pdf` | Unless `--no-pdf` |
| `github-readme.md` | Required | Absent |
| `<document>.claims.json` | Every document | Every document |
| `matching.json` | Absent | Required |

Text/HTML is deterministic for identical inputs/configuration; PDF metadata can vary. No manifest or bundle-verification command exists yet.

## Integrity and privacy

Sidecars use [provenance schema v1](../src/schema/provenance.ts): exact document SHA-256, target and claims with typed source IDs. Tailored targets use `job:<target>` and embed the same report as `matching.json`; the [report schema](../src/schema/job.ts) records requirement coverage, unparsed lines, job digest and optional ordering-provider identity. There is no separate digest for the report file.

`explain` validates one artifact/sidecar pair. It does not certify source facts, disclosure correctness, bundle completeness or authorship. Sidecars contain disclosed claim text; reports may retain sensitive job wording. Review them under the same access policy as their documents.

## Replacement and failures

Managed filenames are replaced. `--no-pdf` removes old PDF/sidecar; tailoring removes GitHub files; generic builds remove the matching report. Unrelated filenames are preserved. Do not put manually maintained documents under managed names.

Validation, composition, provider ordering and PDF rendering finish before output mutation. Subsequent writes/removals are sequential, not atomic: interruption or filesystem failure can leave mixed/partial outputs. On nonzero exit, reject the bundle, rebuild in a fresh directory and verify every expected document. Existing files named `manifest.json` are unmanaged and must not be trusted with this compiler.
