# Provenance and integrity

Every document has a version-1 `<document>.claims.json` sidecar. The [schema](../src/schema/provenance.ts) requires the document SHA-256, target and claims containing text and typed source IDs. Prefixes include person, contact, skill, experience, project, achievement, education, certification, contribution and open-source-project. Links and section claims retain their parent identities. Contact values enter only the sidecars of permitted artifacts.

Generic target names are configured IDs; tailored sidecars use `job:<target>`. Tailored sidecars embed the same structured report written to `matching.json`, including job digest, requirement coverage, unparsed lines and optional editing-provider identity and review flag. The manifest hashes both documents and sidecars plus the report, and records configured target without the `job:` prefix.

`career explain <artifact>` checks that document's digest and sidecar schema before printing attribution and tailoring coverage. `career verify <directory>` checks complete manifest inventory, all hashes and cross-file metadata/report agreement. Both fail on unsupported contracts. Changing a document, sidecar or report requires rebuilding; manually refreshing a hash does not establish factual truth or authorize disclosure.

Sidecars and reports can contain disclosed claims and sensitive job text. Keep their access policy aligned with the documents. Digests are integrity checks, not signatures or proof of authorship. Source disclosure needs a separate [audit and output review](privacy.md). Exact filenames, failure behavior and recovery are in the [artifact contract](artifact-contract.md).

Successful general CV polishing adds `polishing` metadata to CV sidecars: provider/model, `polish-cv-v1` and `reviewRequired: true`. Tailored polishing uses `tailor-cv-v1` in the embedded matching report. GitHub output stays deterministic and has no editing metadata. Rewritten claim text retains the original evidence ID; this attribution does not certify semantic equivalence. See [polishing limits](tailoring.md).
