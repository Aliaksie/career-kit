# Package delivery and compatibility

Use Node.js 24+ and pnpm 10.34.5 for source development. `pnpm install --frozen-lockfile` followed by `pnpm check` runs lint, typechecking, tests and compilation. Matching Chromium is installed separately with `pnpm exec playwright install --with-deps chromium` on the supported CI host. Text-only operation needs no browser or API key.

Run `pnpm test:package` for an actual tarball installation and CLI smoke checks in a temporary consumer. This requires registry access; it does not reuse sibling dependencies. Add `--pack-destination <directory>` to `node scripts/check-package.mjs` to retain the exact tarball and npm inventory/integrity after all checks pass. Retention is refused in reuse mode. For a separate offline smoke check, `node scripts/check-package.mjs --reuse-dependencies` unpacks the actual tarball into a temporary consumer with copied dependency bytes; that mode does not establish clean-install acceptance. The allowlist ships compiled runtime/declarations, schema sources, consumer docs, fictional examples, README, changelog and license. It excludes tests, generated/private consumer content, evidence, credentials and workspace plans.

Profile v1/v2 readers, provenance v1, manifest v1 and audit v1 have separate versions. Pre-1.0 breaking changes require changelog notes and explicit migration guidance before changing consumer input. V1 inputs remain supported; `init` creates v1. Contacts are opt-in v2 fields; no blanket person disclosure or silent migration grants contact access. Manifests newly own `manifest.json`; move any manually maintained file of that name out of managed output before upgrading.

CI should cover locked installation, checks, fictional v1/v2 validation/audit, generic/tailored PDF builds, bundle verification and actual packed-package installation. Hosted execution is evidence only when the intended revision's run succeeds. A local package version is not evidence of a release. Before publishing, verify remote main/tag/package state, choose an available version/distribution channel, align metadata/changelog and retain installed package integrity. Merge/tag/package publication needs its explicit destination authorization.

Consumers pin an exact engine version and lockfile, keep prior source/dependency revisions for rollback, and review regenerated output after upgrades. Private facts/evidence belong in private consumers; public-engine fixtures remain fictional. Never publish source, sidecars or generated artifacts merely to demonstrate package installation.

## GitHub package release

The release workflow runs on a pushed `v<package version>` tag. Normal feature PRs
and merges run checks without publishing; no release branch is required. After
merging a version change and checking that the tag is unused, tag that revision
on `main` and push the tag when ready to publish. Manual dispatch on the same tag
can retry a failed run. Dispatch on a branch or a tag that disagrees with package
metadata fails before publishing.

The workflow reuses CI (including PDF and clean package installation), checks that
the tagged revision belongs to main, and retains the exact tarball from another
successful isolated install. A separate job publishes the tarball, `SHA256SUMS`
and npm `pack.json` integrity metadata to the matching GitHub release. Only that
job receives write permission. Existing releases are not overwritten; inspect a
partial release before recovery. Build artifacts expire after seven days; release
assets remain available. Nothing is sent to npm.

After a successful release, install its exact package URL, for example:

```sh
npm install --save-exact https://github.com/Aliaksie/career-kit/releases/download/v0.2.0/career-kit-0.2.0.tgz
```

Commit the consumer manifest and lockfile; use `npm ci` thereafter. Check the
download against the release checksum and verify installation before switching
the consumer. A source archive lacks the compiled package and is not equivalent.
