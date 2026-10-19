# 003 — Defer Employment → Role migration

Status: proposed, 2026-10-19. D3 recommendation: retain current experiences/projects for this milestone; defer S3.

## Context

The local private consumer has employer-level experience records, projects linked to employers, overlapping assignment periods, conflicting project title/date evidence, and no established promotion timeline. Existing `experiences[].title` summarizes responsibilities over an employer period. Project descriptions and achievement statements carry the supported architecture/leadership detail. These observations justify a modeling decision; private source excerpts do not belong in engine fixtures.

## Decision and examples

Keep one experience per employer and optional `projects[].experience` links. Do not create guessed roles or effective promotion dates. A fictional employer period `2017-11 – present` can render `Software Engineer / Technical Lead — Example Systems`; linked projects describe technical leadership without asserting when a formal title changed. Two overlapping project periods under that employer represent assignments, not simultaneous employers or promotions.

The current renderer presents employer rows followed by selected work. For example, `Software Engineer / Technical Lead — Example Systems (2017-11 – present)` plus project `Cloud migration — architecture and delivery` preserves the employer period and supported work without inventing a dated role. Achievement limits currently apply per experience, despite the option name `maxBulletsPerRole`; document that behavior in the consumer contract.

A new Employment → Role hierarchy could render `Engineer (2017-11 – 2020-06)` followed by `Technical Lead (2020-07 – present)`, but those precise boundaries require evidence the consumer does not currently supply. Preserve contradictory source periods/titles in private attribution until clarified. This decision does not authorize migration of private source or suppression of its caveats.

## Alternatives and reconsideration

Introducing the hierarchy now adds references, migrations and rendering complexity without verified role intervals. Separate experience records for each project would misrepresent assignments as employment. Retaining the current model costs explicit role chronology and role-specific bullet limits; reconsider when at least one consumer supplies confirmed successive roles within one employer and needs that chronology rendered. A future change needs its own versioned contract/migration, preserved achievement links, and before/after provenance checks.
