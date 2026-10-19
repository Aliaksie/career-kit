# Profile schema and migration

One YAML file contains `person`, `skills`, `experiences`, `projects`, `achievements`, `education`, `certifications`, `openSourceContributions`, `targets` and a required profile `version`. V2 also supports `openSourceProjects` and optional `person.contacts`. The [runtime schema](../src/schema/profile.ts) is authoritative; unknown fields and versions fail validation. The fictional [v1](../examples/software-engineer/profile.yaml) and [v2](../examples/software-engineer/profile-v2.yaml) inputs are runnable examples.

Fact IDs use lowercase letters, digits and hyphens and are globally unique across entities and contacts. Target names are separately unique. Projects optionally reference an experience; achievements reference one project and known skill IDs. Dates use `YYYY-MM`; an end must not precede its start. Statements retain separate problem/action/outcome clauses. Every fact requires visibility (`public`, `sanitized`, `private`) and disclosure flags; missing artifact flags deny.

Employer-level experience periods and linked projects express overlapping assignments. Different project titles do not imply formal promotions. Preserve uncertain chronology rather than inventing successive roles. See the [chronology decision](decisions/003-employer-chronology.md).

Targets specify priorities (tag weights from 0 to 1), `maxAchievements` and `experience.maxBulletsPerRole`. Generic ranking sums weights for unique skills/roles/domains/tags, then breaks ties by ID. Bullet limits span projects sharing an experience; projects without one get their own limit. Selection limits achievements; other disclosed facts remain. Source order controls section order.

## Independent open-source work

V1 contributions reference career `project` IDs and inherit those parents' exclusion/selection. V2 contributions reference independent `openSourceProject` IDs. Parents identify repository, name, `relationship: own|upstream`, optional description and disclosure. Canonical duplicate repository URLs are rejected. Both repository and contribution permissions apply; withheld career projects cannot suppress unrelated contributions.

Kinds/statuses are explicit: `pr` uses `open|merged|closed-unmerged`; `issue` uses `open|closed`; `documentation`/`other` use `proposed|completed`; `maintainer` uses `active|former`. PR/issue URLs are required; other URLs optional. Links require absolute HTTPS without credentials, query or fragment. Rendered status preserves unmerged/proposed qualifiers. Disclosed v2 repositories survive tailoring independently of achievement matching. See the [decision](decisions/001-independent-open-source.md).

To migrate, retain the old profile revision and compatible package pin, set `version: 2`, add independent parents and replace contribution `project` references with `openSourceProject`. Preserve IDs/attribution; explicitly choose each repository relationship, contribution kind, evidenced status, URL and parent/child permissions. Keep career projects referenced by achievements. Never infer adoption or inherit permissions automatically. Validate, audit, build and review generic/tailored differences before switching consumers. Rollback restores the prior source and engine pin, then regenerates outputs; it cannot retract published content.

## Contacts

V2 optionally accepts contacts under `person`:

```yaml
contacts:
  - id: work-email
    type: email
    value: alex@example.com
    visibility: public
    disclosure: { cv: true }
  - id: work-phone
    type: phone
    value: '+12025550123'
    visibility: public
    disclosure: { cv: true }
```

These fictional values are CV-only, including tailored CVs. Both person and contact permissions must allow an artifact. Omitting the contact disclosure mapping denies everything. A private contact always denies. Optional IDs become `contact-1`, etc. using original array positions before filtering; collisions fail validation. Use explicit IDs when reordering.

Email uses conservative ASCII syntax, phone uses E.164 and URL uses HTTPS without credentials/query/fragment. Unsafe values fail even when withheld. Links are escaped; provenance uses `contact:<id>`. Contacts never enter provider requests. Profiles without contacts remain supported; keep private sidecars outside compiler input until per-field permissions are explicitly chosen. See the [contact decision](decisions/002-contact-disclosure.md).
