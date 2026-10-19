# Offline tailoring and optional clause ordering

```sh
career tailor --profile profile.yaml --job job.md --target generic --output generated/tailored --no-pdf
career verify generated/tailored
career explain generated/tailored/cv.md
```

Tailoring reuses production CV disclosure, then matches evidence metadata to job requirements. Markdown/text extraction recognizes a technology vocabulary and disclosed skill names, roles, domains and tags. Importance follows line or required/preferred section. Matching uses metadata rather than words that happen to occur in achievement prose. It does not establish proficiency, years, negation or suitability; partly recognized lines may still contain missed constraints. Review `unparsed` and unmatched requirements.

A case-insensitive `.json` suffix selects strict [structured requirements](../examples/software-engineer/job.json). Terms within one requirement are alternatives; separate requirements represent separate needs. Unknown terms stay unmatched. Required matches weigh 2, preferred 1; target priorities break score ties, then IDs establish order. Target/role limits still apply. Coverage records all matching and selected achievement IDs.

Only relevant career projects/experiences/skills survive. V1 contributions follow selected career projects; v2 retains independently disclosed open-source work. Other disclosed person/contact/education/certification fields remain. Output is CV-only with matching report, provenance and manifest; `--no-pdf` skips Chromium. No API key is needed.

## Explicit OpenAI opt-in

Set `OPENAI_API_KEY` and choose a model available to your account supporting structured output:

```sh
career tailor --profile profile.yaml --job job.md --no-pdf \
  --polish openai --model YOUR_STRUCTURED_OUTPUT_MODEL
```

The model chooses context-first (problem/action/outcome) or action-first (action/problem/outcome) for every already-selected achievement. Complete clauses and factual qualifiers remain intact. Unknown, repeated or omitted IDs stop generation. It cannot rewrite, omit clauses or alter selection/rank. Free-form rewriting and semantic matching require separate evaluated contracts.

Only selected CV-disclosed achievement IDs/statements are sent. Person/contact/employment records, unrelated evidence, sidecars and job text are absent. Do not opt in unless those statements may be sent to the provider. The adapter uses Responses structured output, `store: false`, no tools/retries, 30-second timeout, 4096 output tokens, at most 50 achievements and 64000 input bytes. Storage settings do not promise provider-wide retention behavior. Refusal, incomplete or malformed output and HTTP failure stop before output mutation. Sidecars record provider/model and `source-order-v1` prompt identity. Tests use synthetic transport/output fixtures; no live quality result is implied.
