# Compiler architecture

The CLI is the supported consumer boundary. It loads one explicit YAML profile, validates shape/global IDs/references, applies shared artifact disclosure decisions, selects achievements, composes escaped Markdown/HTML and optionally renders PDF. Build computes CV and GitHub inputs separately; tailor uses CV-only matching. Neither reads evidence/contact sidecars or discovers external project files.

Schema modules define independent profile, provenance, matching-report, manifest and audit versions. Application modules own validation/disclosure, ranking/matching, optional clause ordering, artifact staging/publication and bundle verification. Renderers receive only disclosed/selected entities; PDF blocks external requests. The optional provider receives selected achievement IDs/statements rather than a whole profile, job or evidence store.

Build/tailor finish composition/provider/PDF work before destination writes. The shared bundle publisher stages and validates output, owns an exclusive sibling lock, invalidates the old completion marker and publishes a new manifest last. Consumers use its inventory and the verifier rather than directory discovery. Audit shares the production disclosure decisions and checks reported included IDs against actual candidates.

The private consumer owns facts, evidence, disclosure choices, exact engine dependency, CI access and publication review. The public engine owns reusable schemas, renderers, fictional examples and automation. No role hierarchy, config discovery, free-form rewriting or stable provider/plugin API is implied by the internal module structure. See [domain decisions](decisions/README.md) for rationale and [consumer contract](consumer-contract.md) for integrations.
