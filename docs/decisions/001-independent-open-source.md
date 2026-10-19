# 001 — Independent open-source repositories and contributions

Status: proposed, 2026-10-19. Implements the D1 design; schema changes are not yet present.

## Context

Schema v1 requires every contribution to reference a career project. Disclosure in `src/application/profile.ts` and tailoring in `src/application/matching/match.ts` consequently suppress a contribution when that project is withheld or unselected. A repository with several public PRs need not be an employment project. The private consumer demonstrates both multiple contributions to one upstream repository and work on an own-account repository. Only fictional examples belong here.

## Decision

Introduce profile schema v2 with independent top-level `openSourceProjects` and `openSourceContributions`. Keep career `projects` for career work; the same real repository may have a career project and a separately disclosed open-source record without a reference between them.

An open-source project has required `id`, `name`, `repository`, `relationship` (`upstream` or `own`), `visibility`, and `disclosure`; optional `description`. `repository` is a canonical absolute HTTPS repository URL without credentials, query or fragment. Do not restrict hosting to GitHub. Duplicate canonical repository URLs are rejected; match URLs after normalizing the host and trailing slash, without lowercasing case-sensitive paths.

A contribution has required `id`, `openSourceProject`, `kind` (`pr`, `issue`, `documentation`, `maintainer`, `other`), `description`, `status`, `visibility`, and `disclosure`; optional HTTPS `url`. Require a URL for `pr` and `issue`. Status is a discriminated union: PR `open|merged|closed-unmerged`, issue `open|closed`, documentation/other `proposed|completed`, maintainer `active|former`. Invalid kind/status combinations fail validation. `completed` describes contributed work, not upstream merge or adoption. No inferred status from a URL or description.

All IDs, including repository and contribution IDs, are globally unique across the profile. References resolve only to `openSourceProjects`; dangling references fail validation. Independent disclosure applies at both levels. Private/withheld repository excludes every child even if the child grants permission. A withheld career experience or project has no effect on an unrelated open-source repository. Omitted artifact permissions deny access. The person gate still applies.

Generic CV/GitHub render disclosed repositories with disclosed contributions, in input order, grouped by repository. Render explicitly disclosed empty repositories as repository summaries; do not invent activity. Display relationship and contribution kind/status with safe repository/contribution links. Describe a closed-unmerged PR as such; no merge/adoption claim follows from `completed` work or maintainer status. Do not rank or score repositories, contributions, people or productivity. Achievement ranking remains unchanged.

Tailoring includes the disclosed open-source section unchanged, in input order, independent of achievement selection. The matching report continues to cover achievements only; it must not imply that these contributions match a job. This trades some CV length for preserving independently disclosed work without introducing a second selection/scoring system.

Provenance prefixes: `open-source-project:<id>` for repository facts; `contribution:<id>` and `open-source-project:<parent-id>` for each contribution claim. Emit status and link text as attributable claims too. Excluded descriptions/URLs never reach renderers or provider payloads. Open-source facts are not added to the optional ordering provider request.

## Fictional schema-v2 fragment

```yaml
openSourceProjects:
  - id: oss-example-tools
    name: Example Tools
    repository: https://github.com/example/example-tools
    relationship: upstream
    visibility: public
    disclosure: {cv: true, github: true}
openSourceContributions:
  - id: tools-pr-12
    openSourceProject: oss-example-tools
    kind: pr
    status: merged
    url: https://github.com/example/example-tools/pull/12
    description: Fixed argument validation.
    visibility: public
    disclosure: {cv: true, github: true}
  - id: tools-pr-19
    openSourceProject: oss-example-tools
    kind: pr
    status: closed-unmerged
    url: https://github.com/example/example-tools/pull/19
    description: Proposed an alternative transport.
    visibility: public
    disclosure: {cv: true, github: false}
```

There is no career project reference. Withholding `oss-example-tools` excludes both contributions. Withholding a separate career project excludes neither. This fragment is a design example, not valid input to the current v1 CLI.

## Transition and alternatives

Keep a v1 reader and its existing behavior; select readers by explicit profile version and reject unknown versions. V2 removes the legacy contribution `project` field. Publish both readers, migration instructions and release notes before converting private input. Do not auto-promote descriptions into verified status or copy career-project disclosure to repositories.

Migration is an explicit reviewed edit: identify each repository and relationship, retain contribution IDs and attribution where practical, assign new repository IDs, and choose kind/status/URLs from evidence. Keep legacy career projects with linked achievements. Remove redundant career projects only after confirming no remaining references. Record old-to-new parent IDs in consumer attribution and retain the old revision and engine pin. Never modify evidence originals.

Keeping project-linked contributions would preserve current suppression problems. A nested-only contribution model would make global identity/provenance migration less direct. Employment links and contribution scoring add no necessary capability here. Revisit tailoring selection only when consumers show a concrete length/relevance problem.

Acceptance before S1 completion: v1 fixtures unchanged; multiple contributions without career projects; global duplicate/reference rejection; parent/child filtering for CV/GitHub; explicit closed-unmerged rendering; provider isolation; stable source IDs through migration.
