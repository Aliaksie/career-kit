# Changelog

## Unreleased

- Use compact clickable LinkedIn/GitHub labels in contact headers, with visible link styling in the CV print template.

- Replace the flat CV/README renderer with separate templates, grouped skills, employer-owned assignments, compact earlier work, delivered open-source summaries and selected credentials.
- Add optional skill groups and per-artifact presentation budgets to profile v1/v2. Budgets also bound achievement selection; default CV prose leads with the action while retaining all source clauses and qualifiers.
- Support trusted consumer template packs through `build --templates` and `tailor --templates`. Ship templates in the package and derive per-format provenance from actually emitted content tokens. PDF disables JavaScript as well as external requests.
- Presentation compatibility: individual PR/status ledgers and unmerged proposals no longer appear in default output; own repositories use project descriptions. Full records remain available to disclosure audits. Existing inputs still validate; output layout and selected content change. Upgrade the consumer engine pin before adding presentation fields. See [template guidance](docs/templates.md).

## 0.2.0

- Publish tested npm-format packages through a tag-triggered GitHub Actions release workflow, including checksums and npm integrity metadata. Ordinary PRs and main pushes run checks only.

Profile schema v1 remains supported. Schema v2 migration is explicit; see
[schema guidance](docs/schema.md). Build directories now reserve `manifest.json`;
move any manually maintained file with that name before upgrading.

- Ship consumer docs and schema sources, reorganize guidance around compiler/privacy/artifact contracts, and include fictional CV-only contacts in the v2 example.

- Add `audit --artifact cv|github [--json]` using the production disclosure decision function. Versioned reports contain IDs/reasons and fixed error codes without private values or source paths; person denial yields ordinary exclusions.

- Build/tailor now publish manifest v1 with package/input identity, artifact inventory and digests. New `verify` checks complete bundles. Staged writes, exclusive output locks and last-written completion markers reject interrupted/stale output; existing unrelated files remain untouched.

- Add optional v2 contacts with independent deny-by-default disclosure, stable IDs and validated email/phone/HTTPS links. No contact data is migrated automatically; contacts never enter provider requests.

- Support profile schema v2 with independently disclosed open-source repositories and typed contributions, safe links, explicit status and stable contribution provenance. Generic and tailored output retain these records independently of career-project selection.
- Profile schema v1 and its rendering/tailoring semantics remain supported. Migration is explicit; see the README and fictional v2 profile. No private source is migrated automatically.
