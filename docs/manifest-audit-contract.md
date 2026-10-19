# Planned manifest and publication audit contracts

Status: specification for D5 and S4/S5, 2026-10-19. Neither feature exists in the current CLI. The JSON Schemas in `docs/contracts/` are design artifacts and must become runtime validators before implementation is complete. They are independent of profile schema versions. No current bundle is claimed to satisfy this specification.

## Manifest v1

`manifest.json` is the sole inventory of a completed build/tailor bundle. Validate with [manifest-v1.schema.json](contracts/manifest-v1.schema.json). Required fields:

- `version: 1`; `compiler: {name: "career-kit", version: <actual installed package version>}`. Read metadata relative to the installed module; do not derive version from cwd or copy the CLI's hardcoded string.
- `profileSchemaVersion: 1|2`; `profileSha256`: digest of exact input bytes, with no source path. A digest identifies input but does not reveal it or prove disclosure correctness.
- `kind: build|tailor`; `target`: configured target name, never the sidecar's `job:` prefix.
- `artifacts`: nonempty document array of `{path, format, sha256, provenance: {path, version: 1, sha256}}`. Formats are `markdown|html|pdf`.
- `report`: `{path: "matching.json", sha256}` for tailor only. No report for build. SHA-256 values describe exact stored bytes.

Paths are bundle-relative POSIX filenames; no absolute paths, backslashes, empty segments, dot segments, query/fragment, symlinks or duplicate paths anywhere in the inventory. Validate path containment and regular files before reading; do not follow symlinks. V1 permits only the fixed filenames below. The manifest does not list itself or record private paths/values. No timestamps are required, preserving deterministic text builds. Digest equality is integrity checking, not a signature.

Semantic checks beyond JSON Schema: build lists `cv.md`, `cv.html`, `github-readme.md`; tailor lists `cv.md`, `cv.html` and its report. Either may list `cv.pdf`, only when produced. Exactly one matching sidecar per document; formats match filenames; all listed paths and sidecars are unique. Verify each sidecar schema, its document digest, expected target (`job:<target>` for tailor), and embedded tailoring against the hashed report. No PDF or PDF sidecar exists after `--no-pdf`; no GitHub files remain after tailor; no report remains after build. The manifest profile version and compiler metadata describe the actual run.

### Completion and stale files

Resolve/validate inputs and finish provider/PDF work before touching the destination. Stage all output bytes and validate their digests/contracts in a sibling temporary directory first. A staging failure leaves an old completed bundle untouched. Preserve unrelated destination files.

Before changing any destination managed file, remove its existing manifest; if that fails, stop without changing documents. Replace managed files from staging, remove obsolete managed files, then atomically rename a staged manifest into place **last**. Only success after this final rename returns 0. This is a completion-marker protocol, not an atomic whole-directory replacement. A write failure/interruption after invalidation leaves no manifest and therefore an invalid bundle; never restore an old manifest over partially replaced files. Handle concurrent writers with exclusive destination ownership: reject a second writer using a lock directory and exit 1 before mutation; do not auto-delete unknown/stale locks. Document explicit recovery after confirming the original writer stopped.

Manifest consumers reject missing manifests, unsupported versions, missing/changed files, malformed sidecars, mismatched report copies and obsolete managed files. They ignore unrelated filenames; they do not discover output by scanning them. Interrupted staging/lock leftovers are not publishable outputs. A crash before invalidation can leave the prior complete bundle valid; a crash after invalidation cannot certify the partially changed bundle. Staging must not copy private evidence or source input into the output directory.

## Audit v1

Proposed commands:

```sh
career audit --profile profile.yaml --artifact github
career audit --profile profile.yaml --artifact cv --json
```

`--artifact` is required and accepts `cv|github`; reject `portfolio` until its renderer exists. `--profile` defaults to `profile.yaml`, resolved from cwd as with existing commands. Audit has no build target: it reports source disclosure before ranking/tailoring. It writes no artifacts and invokes no provider/browser. The optional `--json` makes stdout exactly one [audit-v1.schema.json](contracts/audit-v1.schema.json) object, including failures; human diagnostics go to stderr. Consumers use exit status, `ok` and codes, never prose parsing.

For a valid profile enumerate person, every entity, open-source parent/child and every contact in original source order; normalize optional contact IDs before filtering. `records` contains only `{source, decision: included|excluded, reason}`. Included means eligible for renderer input before selection, not guaranteed printed. Reasons have deterministic precedence: `private`, then `not-disclosed`, then `parent-excluded`, then `skill-excluded`, else `allowed`. Parent means experience/project/open-source project as applicable; person exclusion gates every record. Direct private/missing permission takes precedence over an excluded ancestor. Skill exclusion applies to achievements whose referenced skills were withheld.

Person denial is an ordinary complete exclusion report with exit 0 if all renderer inputs are blocked. It explains why build would reject that artifact; audit success is privacy consistency, not buildability. Explicitly excluded entities are expected and do not fail audit. A policy violation is disagreement between the audit decision and the actual post-disclosure renderer candidate set, or a forbidden contact/entity/value crossing that boundary. Such disagreement exits 1 with `ok: false` and `POLICY_VIOLATION`. Implement one shared decision function returning filtered input and reasons; production disclosure and audit both use it. Test boundary leakage with instrumented renderer/provider inputs, not a second privacy filter.

JSON never includes names, descriptions, contact values, URLs, raw profile text, job text or evidence paths. `source` exposes typed IDs intentionally, with the same source prefixes as provenance; generated contact IDs do not contain values. IDs themselves can be sensitive metadata, so audit output is still private by default. Errors contain fixed code and safe field paths only. Do not serialize raw schema exceptions, file paths or exception messages. A missing/unreadable file yields `INPUT_UNREADABLE`; invalid syntax/schema/references `INVALID_PROFILE`; unknown profile version `UNSUPPORTED_PROFILE_VERSION`; invalid/missing artifact option `INVALID_ARTIFACT`; unexpected runtime failure `INTERNAL_ERROR`. These are exit 1 reports with empty records. Parse `--json` early enough to return JSON on argument failures. Successful reports have `ok: true`, no errors; rejected reports have `ok: false`, at least one error. Failures without a valid artifact omit the `artifact` field rather than echoing arbitrary input.

## Acceptance cases

| Case | Required result |
| --- | --- |
| Generic/tailor success | Exit 0; valid manifest inventory, metadata, schemas and all digests; audit enumerates deterministic decisions. |
| Target/schema/provider/PDF rejection before destination mutation | Exit 1; prior complete bundle unchanged; no new manifest or staged output published. |
| Failure during destination writes / forced interruption | Exit nonzero where observable; no completion manifest; verifier rejects partial bundle. |
| Concurrent writer / lock present | Exit 1 before destination mutation; no guessing lock ownership. |
| `--no-pdf` after PDF build | Old PDF/sidecar removed; neither listed; unrelated files preserved. |
| Build → tailor → build | Obsolete GitHub/report files removed appropriately; inventory only current files. |
| Missing listed document/sidecar/report, changed bytes, stale managed file | Bundle verifier rejects, even if remaining sidecars pass `explain`. |
| Unsupported manifest/provenance/profile version | Fail closed, structured audit error for input version; never silently reinterpret. |
| Private entity/contact, omitted flags, withheld parent/skill | IDs/reasons only in audit; zero excluded values in renderer/provider/provenance. |
| CV-only email and phone | Included in CV; excluded in GitHub; absent from provider and audit values in both modes. |
| Invalid/unsafe contact or malformed input | Exit 1 before writes; redacted audit diagnostic. |
| Invalid artifact / missing input | Exit 1 and structured JSON when requested; no raw values/paths. |
| Correct source audit plus manually edited output | Audit may pass; manifest/digest verification must independently fail on changed bytes. |

S4 must provide a documented bundle-verification entry point usable by consumers without duplicating runtime schema logic; CLI spelling is deferred to implementation documentation. S5 must exercise the same disclosure decisions as build/tailor. Audit certifies the input decision boundary only. Even matching manifests/digests cannot prove authorship or revoke previously disclosed information; publication still requires review of the exact bundle and explicit destination authorization.
