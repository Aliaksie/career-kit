# Compiler delivery

Source: `../.plan/career-kit-plan.md` in the containing workspace. One feature branch / PR; each delivery has its own commit.

Scope: v0.1 compiler and MVP. v0.2 intelligent tailoring, v0.3 import, v0.4 extended authoring, and v1.0 integrations remain roadmap work. No personal source files are imported.

1. Foundation: Node 24 / TypeScript / pnpm, strict YAML schema, reference validation, disclosure filtering, target ranking, synthetic profile. Verify invalid references, privacy boundaries and deterministic selection.
2. Artifacts and CLI: init, validate, build; deterministic Markdown, HTML, PDF and GitHub README; provenance sidecar and explain. Verify escaping, artifact-specific disclosure, CLI and real PDF rendering. Tailor is deferred with v0.2.
3. Delivery: documentation and PR CI that installs, lints, typechecks, tests, builds, validates and generates the synthetic example.

Decisions: one YAML file owns facts and targets; IDs are global; missing disclosure defaults to false; private entities and dependents of withheld parents are excluded before composition; renderers receive only filtered data. No LLM dependency in v0.1. Sanitized means the supplied text has already been sanitized by its owner. Generated text uses exact source statements, so provenance can be checked without semantic inference.
