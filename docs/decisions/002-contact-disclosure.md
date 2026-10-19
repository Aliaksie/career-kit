# Independent contact disclosure

Status: accepted and implemented, 2026-10-19; optional schema-v2 contacts.

Add optional schema-v2 `person.contacts` with type, value, visibility, explicit artifact permissions and optional globally unique ID. Omitted permissions deny access. Both person and contact must permit the artifact. For omitted IDs, use original array position (`contact-1`, etc.) before filtering and reject collisions; explicit IDs avoid identity changes on reorder.

Support validated email, E.164 phone and absolute HTTPS URL values. Reject controls, credentials, unsafe schemes and header/query injection; generate safe escaped links. CV-only email/phone must stay out of GitHub. Filter before rendering; excluded values cannot enter provenance or audit. Contacts never enter provider requests, even when CV-disclosed. Diagnostics identify fields without echoing values.

Independent permissions avoid accidental disclosure through the person record. Keep contact sidecars outside compiler input until the owner makes field-level choices; profiles without contacts remain compatible. Anonymous IDs trade authoring convenience for positional identity.
