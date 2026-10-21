# Disclosure and publication

Every fact has `visibility` and artifact-specific `disclosure`. Private always denies; omitted flags deny; sanitized means the author has already sanitized the supplied text. The compiler does not anonymize evidence. Person denial blocks the entire artifact. Withheld experiences suppress linked projects, withheld projects suppress achievements and legacy contributions, and withheld skills suppress dependent achievements. V2 open-source parents gate their children independently of career projects. Contacts have their own permissions; person permission cannot disclose them.

Build, tailor and audit share one decision function (`application/disclosure`). Filtering precedes selection, rendering and optional provider editing. Only selected CV achievement IDs/statements, protected phrases derived from them and (for tailoring) extracted job requirements enter provider requests. Contacts, private evidence sidecars, person/employment records and raw job text do not. Extracted requirements can still contain confidential job information. Opt in only when these exact values may leave the machine. See [polishing guardrails and review limits](tailoring.md).

## Audit v1

```sh
career audit --profile profile.yaml --artifact github --json
career audit --profile profile.yaml --artifact cv
```

Artifact is required: `cv` or `github`. Audit has no target, filesystem output, browser or provider call. It reports eligibility before ranking; included does not guarantee a fact is printed. Person denial is a successful complete exclusion report, although build would reject it.

JSON uses the [audit v1 runtime schema](../src/schema/audit.ts): `version`, `ok`, optional validated `artifact`, `records` and `errors`. Each record has only typed `source` ID, `decision` and `reason`. Reasons have precedence `private`, `not-disclosed`, `parent-excluded`, `skill-excluded`, `allowed`. Contacts use explicit or original-position generated IDs. Array order follows person, contacts, skills, experiences, projects, achievements, education, certifications, v2 open-source parents, contributions, preserving each collection's source order.

Successful reports have `ok: true`, no errors, exit 0. Explicit exclusions are expected. A mismatch between recorded included IDs and actual renderer candidates fails with `POLICY_VIOLATION`. Rejected reports have `ok: false`, empty records, fixed error codes and exit 1. Codes are `INPUT_UNREADABLE`, `INVALID_PROFILE`, `UNSUPPORTED_PROFILE_VERSION`, `INVALID_ARTIFACT`, `INTERNAL_ERROR`, `POLICY_VIOLATION`. Missing/invalid artifact and audit argument errors use `INVALID_ARTIFACT`. Missing/unreadable input uses `INPUT_UNREADABLE`; malformed schema/references/syntax uses `INVALID_PROFILE`. No error echoes input values, raw schema errors or file paths. `--json` emits one JSON report for ordinary success and failures, including argument failures; help remains human-readable. Human-mode failures print fixed codes to stderr.

Reports omit names, descriptions, contact values, URLs and evidence paths. IDs themselves may be sensitive metadata: audit reports remain private by default. A permissive source audit does not certify a manually edited output. Before publication, audit the exact source, rebuild, run `career verify <directory>`, inspect the resulting artifact diff and choose the intended destination/access. Digests provide integrity checks, not signatures, factual verification or permission to publish. Published information cannot be retracted by reverting a disclosure flag.
