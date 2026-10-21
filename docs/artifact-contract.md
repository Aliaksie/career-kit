# Artifact contract

## Inventory and verification

`manifest.json` version 1 is the completion marker and inventory for build/tailor. Run `career verify <directory>` before consuming a bundle. It validates the [runtime manifest schema](../src/schema/manifest.ts), every document/sidecar/report digest, provenance schema/target and report copies, and rejects missing or obsolete managed files. Unknown versions, duplicate paths, incorrect formats and symlinked/nonregular entries fail closed. Unrelated filenames are ignored.

| Output | Build | Tailor |
| --- | --- | --- |
| `cv.md`, `cv.html` | Required | Required |
| `cv.pdf` | Unless `--no-pdf` | Unless `--no-pdf` |
| `github-readme.md` | Required | Absent |
| `<document>.claims.json` | Every document | Every document |
| `matching.json` | Absent | Required |
| `manifest.json` | Required | Required |

The manifest records the actual installed package version, profile schema version, input SHA-256, configured target, build kind, relative filenames/formats and document/sidecar/report digests. CLI input digest identifies exact profile-file bytes without recording its path. Internal callers using constructed or modified objects get a digest of `JSON.stringify(profile)` instead; the CLI is the supported consumer boundary. Manifest, profile and provenance versions are independent. Text/HTML and manifests are deterministic for identical inputs/configuration; PDF metadata can vary.

## Integrity and privacy

Sidecars use [provenance v1](../src/schema/provenance.ts): exact document SHA-256, target and claims with typed source IDs. Tailored targets use `job:<target>` and embed the same report as `matching.json`; the [report schema](../src/schema/job.ts) records coverage, unparsed lines, job digest and optional ordering-provider identity. The manifest target has no `job:` prefix.

`explain` validates one document/sidecar pair; `verify` validates bundle completeness. Neither proves source facts, disclosure correctness or authorship. Sidecars contain disclosed claim text; reports can retain sensitive job wording. Review them under the same access policy as documents. Verification assumes a consumer-owned directory without hostile concurrent filesystem mutation; final-component file reads refuse symlinks. Do not modify or publish bundles while a writer is active.

## Replacement and failures

Managed filenames are replaced; `--no-pdf` removes old PDF/sidecar, tailoring removes GitHub files, and build removes the matching report. Unrelated files are preserved. Do not manually maintain managed filenames, including `manifest.json`.

Validation, composition, optional provider work and PDF work finish before output mutation. Failed or invalid optional polishing falls back to deterministic composition. The writer acquires an exclusive sibling `<output>.career-lock` directory, stages and verifies bytes in a sibling temporary directory, removes the destination manifest, replaces/removes managed files, then atomically renames the new manifest into place last. This is a completion-marker protocol, not an atomic directory swap. Staging failure preserves the previous completed bundle. Failure after invalidation leaves no completion marker, so verification rejects the bundle. A process crash can leave staging/lock directories; they are not publishable outputs.

A lock already present makes the writer fail without changing managed output. Never automatically remove an unknown lock. After confirming its writer has stopped, remove the sibling lock and any abandoned sibling `.career-stage-` directory, rebuild, and verify. A nonzero build is not a completed new bundle. Rebuild after filesystem failures; never restore an old manifest over mixed files.
