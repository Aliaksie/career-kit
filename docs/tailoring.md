# Offline tailoring and optional clause ordering

```sh
career tailor --profile profile.yaml --job job.md --target generic --output generated/tailored --no-pdf
career verify generated/tailored
career explain generated/tailored/cv.md
```

Tailoring reuses production CV disclosure, then matches evidence metadata to job requirements. Markdown/text extraction recognizes a technology vocabulary and disclosed skill names, roles, domains and tags. Importance follows line or required/preferred section. Matching uses metadata rather than words that happen to occur in achievement prose. It does not establish proficiency, years, negation or suitability; partly recognized lines may still contain missed constraints. Review `unparsed` and unmatched requirements.

A case-insensitive `.json` suffix selects strict [structured requirements](../examples/software-engineer/job.json). Terms within one requirement are alternatives; separate requirements represent separate needs. Unknown terms stay unmatched. Required matches weigh 2, preferred 1; target priorities break score ties, then IDs establish order. Target/role limits still apply. Coverage records all matching and selected achievement IDs.

Only relevant career projects/experiences/skills survive. V1 contributions follow selected career projects; v2 retains independently disclosed open-source work. Other disclosed person/contact/education/certification fields remain. Output is CV-only with matching report, provenance and manifest; `--no-pdf` skips Chromium. No API key is needed.

## Explicit AI opt-in

Choose a provider and an explicit model that supports structured output:

```sh
export OPENAI_API_KEY=YOUR_KEY
career tailor --profile profile.yaml --job job.md --no-pdf \
  --polish openai --model YOUR_STRUCTURED_OUTPUT_MODEL
```

Providers use these environment variables by default:

| `--polish` | API key variable | Endpoint |
| --- | --- | --- |
| `openai` | `OPENAI_API_KEY` | OpenAI Responses API |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic API |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` | Google Generative AI API |
| `openai-compatible` | `LLM_API_KEY` (optional for local servers) | `--endpoint` required |

Override any provider's API base URL with `--endpoint`. Choose another key variable with `--api-key-env NAME`; the key itself stays in the environment. An explicitly named key variable must contain a value. Endpoint URLs cannot include credentials, a query or a fragment. For a local server exposing structured Chat Completions:

```sh
career tailor --profile profile.yaml --job job.md --no-pdf \
  --polish openai-compatible --model YOUR_LOCAL_MODEL \
  --endpoint http://localhost:1234/v1
```

The existing `LanguageModel` interface uses Vercel AI SDK adapters internally. Model capability and access depend on the selected provider/server. Normal builds and offline tailoring make no model calls.

The model chooses context-first (problem/action/outcome) or action-first (action/problem/outcome) for every already-selected achievement. Complete clauses and factual qualifiers remain intact. Unknown, repeated or omitted IDs reject the model result and use the deterministic clause order. It cannot rewrite, omit clauses or alter selection/rank. Free-form rewriting and semantic matching require separate evaluated contracts.

Only selected CV-disclosed achievement IDs/statements are sent. Person/contact/employment records, unrelated evidence, sidecars and job text are absent. Opt in only when those statements may be sent to the selected provider and endpoint. The adapter uses schema-validated structured output, no tools/retries, a 30-second timeout, 4096 output tokens, at most 50 achievements and 64000 input bytes. OpenAI Responses requests set `store: false`; this does not promise provider-wide retention behavior.

Refusal, incomplete or malformed output and HTTP failure emit a fixed warning and generate the original deterministic CV. Invalid configuration still fails before generation. The prompt lives in `prompts/clause-order.md`. After successful polishing, sidecars record provider/model and `source-order-v1` prompt identity. Tests use fictional transport/output fixtures; no live model quality result is implied.

For a manual quality check, use these fictional examples under `examples/software-engineer/`:

| Profile and job | Review focus |
| --- | --- |
| `profile.yaml` and `job.md` | Complete problem/action/outcome clauses and unchanged selected IDs. |
| `profile-v2.yaml` and `job.json` | The same factual preservation, with independent open-source summaries unchanged by polishing. |

Run each first offline and then with polishing enabled in separate output directories. Compare `cv.md`: every source clause, qualifier and attribution must remain intact, the selected IDs must match, and the reordered version should read at least as well. Inspect `matching.json` for polishing metadata; its absence and a warning indicate fallback. No general evaluation service is needed.
