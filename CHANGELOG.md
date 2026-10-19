# Changelog

## Unreleased

- Ship consumer docs and schema sources, reorganize guidance around compiler/privacy/artifact contracts, and include fictional CV-only contacts in the v2 example.

- Add `audit --artifact cv|github [--json]` using the production disclosure decision function. Versioned reports contain IDs/reasons and fixed error codes without private values or source paths; person denial yields ordinary exclusions.

- Build/tailor now publish manifest v1 with package/input identity, artifact inventory and digests. New `verify` checks complete bundles. Staged writes, exclusive output locks and last-written completion markers reject interrupted/stale output; existing unrelated files remain untouched.

- Add optional v2 contacts with independent deny-by-default disclosure, stable IDs and validated email/phone/HTTPS links. No contact data is migrated automatically; contacts never enter provider requests.

- Support profile schema v2 with independently disclosed open-source repositories and typed contributions, safe links, explicit status and stable contribution provenance. Generic and tailored output retain these records independently of career-project selection.
- Profile schema v1 and its rendering/tailoring semantics remain supported. Migration is explicit; see the README and fictional v2 profile. No private source is migrated automatically.
