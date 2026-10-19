# Artifact contract — current outputs

Applies to the current implementation in `src/application/build.ts`, `tailor.ts` and `src/schema/{provenance,job}.ts`. See the [consumer contract](consumer-contract.md) for invocation and the [planned bundle contract](manifest-audit-contract.md) for future inventory verification.

## Inventory

| File | Generic build | Tailor |
| --- | --- | --- |
| `cv.md`, `cv.html` | Required | Required |
| `cv.pdf` | Required by default; absent with `--no-pdf` | Same |
| `github-readme.md` | Required | Absent |
| `<document>.claims.json` | Required for every produced document | Same |
| `matching.json` | Absent | Required |
| `manifest.json` | Not implemented | Not implemented |

All files are direct children of the explicit output directory. `matching.json` has no sidecar of its own. There is no supported directory-scanning inventory API yet. Consumers integrating the current release must use the fixed inventory and process success, then verify every expected document; a future manifest will supersede this fixed inventory.

Text/HTML contents are deterministic for identical validated input/target/job and ordering configuration. PDF metadata may vary across browser runs. The HTML contains inline styling; the PDF browser routes all page requests to abort, blocking remote and local-file resource loads. This is an implementation boundary; supported-host PDF acceptance is still outstanding.

## Provenance version 1

Each sidecar is a strict JSON object with:

- `version: 1`, `target` string, lowercase 64-hex `sha256` of the exact document bytes.
- `claims`: array of `{text: string, sources: string[]}`; each sources array has at least one entry.
- Optional `tailoring` as described below.

Generic targets use their configured name; tailored sidecars use `job:<target-name>`. Source prefixes are `person`, `skill`, `experience`, `project`, `achievement`, `education`, `certification`, `contribution`, followed by `:<input-id>`. Achievement claims include achievement and project IDs; contribution claims include contribution and project IDs. Source IDs identify compiler input records, not private evidence paths. Section headings without factual source data need not be claims.

Sidecars contain disclosed claim text, so handle them with the same privacy as their documents. They are neither signatures nor evidence attestations. They do not include source profile hashes or compiler identity. `explain` hashes the artifact, compares the sidecar digest and validates the sidecar schema; it does not reload the profile, resolve source IDs against it, validate chronology, certify disclosure policy or establish bundle completeness. A person able to alter both files can manufacture a matching pair.

## Matching report

`matching.json` is the same strict `tailoring` object embedded in each tailored sidecar:

- `jobSha256`: lowercase SHA-256 of the UTF-8 job string supplied to matching.
- `extraction`: `keywords` or `structured`; `unparsed`: string array.
- `coverage`: array of `{requirement, matched, selected}`. Requirements retain `id`, `label`, `terms`, `importance`; matched/selected arrays contain achievement IDs, not prose.
- Optional `polishing`: `{provider, model, promptVersion: "source-order-v1"}` when ordering was used on a nonempty selection.

Unknown requirements remain in coverage with empty matches. Unparsed lines and requirement labels may contain job-sensitive text; do not treat reports/sidecars as automatically public. A report does not grant permission to publish job content. No separate provenance sidecar authenticates `matching.json`; embedded copies are not a signed report digest.

## Replacement and failure semantics

Build and tailor replace their managed document/sidecar names. `--no-pdf` removes old `cv.pdf` and its sidecar. Tailor removes old GitHub README/sidecar; generic build removes old `matching.json`. Reusing an output directory changes its kind; do not place manually maintained files under managed names. Other filenames are preserved. Existing `manifest.json` is currently unmanaged and can remain stale; do not trust it with this version.

Validation, target lookup, disclosure/composition and optional provider ordering happen before output mutation. PDF rendering also completes before directory creation/writes; a browser failure therefore does not update the bundle. After this point writes/removals happen sequentially and are **not atomic**: disk/permission/process failures can leave partial files, mixed old/new outputs or artifact/sidecar disagreement. No rollback or completion marker exists. On any nonzero exit, treat the entire output directory as unverified; rebuild in a fresh directory and verify expected documents before use. There is no guarantee that an old successful bundle survives an interrupted write.

Success means awaited writes completed; it does not ensure durable storage after hardware failure. Publication requires separate review and permission. Source auditing planned for S5 cannot certify manually edited output; pair it with digest and future manifest verification.
