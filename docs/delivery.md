# Compiler delivery

Source: `../.plan/career-kit-plan.md` in the containing workspace. One feature branch / PR; each delivery has its own commit.

Scope: v0.1 compiler and MVP. v0.2 intelligent tailoring, v0.3 import, v0.4 extended authoring, and v1.0 integrations remain roadmap work. No personal source files are imported.

1. Foundation: Node 24 / TypeScript / pnpm, strict YAML schema, reference validation, disclosure filtering, target ranking, synthetic profile. Verify invalid references, privacy boundaries and deterministic selection.
2. Artifacts and CLI: init, validate, build; deterministic Markdown, HTML, PDF and GitHub README; provenance sidecar and explain. Verify escaping, artifact-specific disclosure, CLI and real PDF rendering. Tailor is deferred with v0.2.
3. Delivery: documentation and PR CI that installs, lints, typechecks, tests, builds, validates and generates the synthetic example.

Decisions: one YAML file owns facts and targets; IDs are global; missing disclosure defaults to false; private entities and dependents of withheld parents are excluded before composition; renderers receive only filtered data. No LLM dependency in v0.1. Sanitized means the supplied text has already been sanitized by its owner. Generated text uses exact source statements, so provenance can be checked without semantic inference.

## Verification — 2026-10-19

- Deliveries 1 and 2 are implemented. `pnpm check` passes: lint, strict typechecking, nine tests across three suites, and TypeScript compilation. Tests execute compiled output and exercise validation, disclosure cascades, ranking, renderer escaping, deterministic output, stale PDF removal, provenance integrity, and the CLI from a separate directory.
- Compiled CLI validates the fictional example, generates Markdown/HTML/GitHub artifacts with `--no-pdf`, and explains the generated CV. `init` is covered by the CLI test, including refusal to overwrite an existing profile.
- `npm pack --dry-run` confirms that the package contains compiled CLI modules and the fictional example, excluding private profiles and tests.
- Registry DNS was unavailable. Local verification used packages from the existing npm cache, installed through a temporary cache index outside the repository. The pnpm lockfile was generated from cached registry metadata, including native optional dependencies. No shared package-manager configuration was changed. A clean network installation has not run here.
- The default pnpm launcher points at a missing installation; checks used the installed pnpm 10.34.5 executable through a temporary PATH wrapper.
- PDF smoke testing is blocked locally: the expected Chromium revision is absent; launching the available cached Chromium fails with a macOS sandbox Mach-port permission error. PDF output is implemented but not verified here. CI installs the matching browser and runs the full build; remote CI has not yet run.
- Direct review of the source and working tree found and corrected stale PDF retention during `--no-pdf` builds. No independent agent review was performed.

Deliveries remain grouped into three commits on `feat/career-kit-compiler`. No branch has been pushed and no remote PR has been opened.

## Local consumer verification — 2026-10-19

With owner authorization, validated a separate local consumer profile without copying its data into this repository. All four configured targets built Markdown, HTML and GitHub artifacts successfully. Every artifact passed digest/provenance verification; every recorded source ID belonged to the artifact's disclosed entities and selected achievements. Outputs remain in the consumer repository's ignored generated directory. Private supporting evidence and contact files were not used as compiler inputs.

Retried the cached Chromium after explicit owner authorization. Launch still fails at macOS Mach-port registration (`MachPortRendezvousServer: Permission denied`). This is an execution sandbox restriction, independent of task authorization. PDF verification remains blocked in this session; no browser configuration or security restrictions were changed.
