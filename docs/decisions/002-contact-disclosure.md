# 002 — Contact permissions are independent of person disclosure

Status: proposed, 2026-10-19. Implements the D2 design; current schema rejects contacts.

## Context and decision

The private consumer keeps contacts in a sidecar outside compiler input. Person-level disclosure must not expose that sidecar or grant blanket permission to future contacts. Add optional `person.contacts` in schema v2, defaulting to an empty array; v1 inputs continue to use the v1 reader. No contact is imported until its owner chooses permissions per field.

Each contact requires `type` (`email`, `phone`, `url`), `value`, `visibility`, and a `disclosure` object. Optional `id` uses the ordinary ID syntax and global uniqueness rules. Missing artifact flags are false; a missing disclosure object is invalid. Private visibility always denies disclosure. Both person and contact must permit the artifact; withholding the person still rejects that artifact. Contact permissions never inherit from the person or another contact.

For stable references without mandatory IDs, assign omitted IDs `contact-1`, `contact-2`, etc. from the original input array index before filtering. Reject collisions with explicit IDs or any other entity ID; suggest explicit IDs for long-lived records. Reordering anonymous contacts changes identity and must be called out in migration notes. A normalized contact uses `contact:<effective-id>` in provenance and audit, with no value in its ID.

```yaml
# Fictional schema-v2 person fragment; not accepted by the current CLI.
contacts:
  - id: work-email
    type: email
    value: alex@example.com
    visibility: public
    disclosure: {cv: true, github: false, portfolio: false}
  - id: work-phone
    type: phone
    value: '+12025550123'
    visibility: sanitized
    disclosure: {cv: true, github: false, portfolio: false}
```

These contacts appear in CV only. Public visibility alone grants nothing. Profiles without contacts render as before.

## Validation and rendering

Trim surrounding whitespace. Reject embedded control characters and newlines for every type. Email accepts a single validated mailbox without display-name, header, query or fragment syntax. Phone uses E.164 (`+` followed by 8–15 digits, first digit nonzero); reject extensions rather than guessing. URL accepts absolute HTTPS only, with nonempty host and no credentials. Reject `javascript:`, `data:`, `file:`, protocol-relative links, malformed percent encoding and encoded controls. Reject URL query and fragment for this initial contact contract to avoid hidden recipient/header parameters.

Generate `mailto:` and `tel:` only from validated email/phone values; source values cannot supply a scheme. Attribute-escape HTML and escape Markdown labels/destinations using a shared safe-link helper. Link text is the validated value, not source-supplied markup. Unsafe input fails validation before writes, even when the contact is withheld.

Filter contacts before composition. Excluded values must not occur in renderer input, provenance claims, output or audit values. Included contact claims may contain their disclosed display value, with contact-specific source IDs. Never send contacts to the optional provider, even if CV-disclosed; it continues to receive selected achievement IDs/statements only. Do not include raw input, validation values, provider errors containing input, or source excerpts in JSON audit failures. Contact validation diagnostics identify field path/code only, never rejected values.

## Consequences and alternatives

A single person-level permission is simpler but cannot express CV-only email/phone. Free-form contact strings would complicate safe links and validation. Requiring every ID would be simpler for provenance, but optional IDs support short profiles; deterministic fallback and collision rejection carry the cost explicitly.

The consumer sidecar remains untouched. V2 migration instructions describe anonymous ID behavior and require explicit field-level choices. No contact decision implies publication authorization. Verification must cover absent contacts, independent CV/GitHub permissions, private/missing flags, person exclusion, ID collisions, malicious links/markup, redacted errors, renderer boundaries and provider payloads.
