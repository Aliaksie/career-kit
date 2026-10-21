# Offline tailoring and optional AI polishing

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

Two modes use separate structured Markdown prompts:

- `career build --polish PROVIDER --model MODEL`: general CV achievement polishing (`prompts/polish-cv.md`). GitHub output remains deterministic.
- `career tailor --job job.md --polish PROVIDER --model MODEL`: job-aware achievement polishing (`prompts/tailor-cv.md`). Deterministic matching selects and ranks evidence first; the model receives extracted requirements, including unmatched ones, to guide supported emphasis. Review extraction gaps in `matching.json`.

Each prompt has YAML frontmatter (`name`, integer `version`, `description`, `parameters.maxTokens`, optional `parameters.temperature`), followed by explicit `system:` and `user:` sections. The loader validates the metadata, sends the sections as their respective roles, and appends serialized input as user data. Editing prompts currently request 8192 output tokens and temperature 0; models that reject a parameter fall back. Adjust the prompt's optional temperature for those models. Increment the prompt version and accepted provenance identity when changing its contract. `clause-order.md` remains an internal extractive helper, not a third CLI editing mode.

The model can rewrite problem/action/outcome wording and choose clause order. It cannot change selected IDs, membership or rank, employment, summaries, skills or independent open-source work. Normal builds and offline tailoring remain deterministic.

Only selected CV-disclosed achievement IDs/statements, protected phrases derived from them, and (for tailoring) schema-validated extracted requirements enter the request. Person/contact/employment records, unrelated evidence, sidecars and raw job text are absent. Job requirements may contain confidential information: opt in only when these values may be sent to the chosen endpoint. Both prompt sections treat input values as data, never instructions. No model tools are available.

Before a call, application validation enforces at most 50 achievements, 4000 characters per clause, no control characters, at most 100 requirements and 64000 serialized input bytes. The adapter also enforces the input byte budget, a 30-second timeout and zero retries. OpenAI Responses requests set `store: false`; this does not promise provider-wide retention behavior.

Output must pass a strict schema and domain checks: every ID exactly once in source order; bounded nonempty clauses; unchanged numeric quantities/units; retained known technical terms and protected phrases; no newly introduced known skill or requirement term in a clause; no added links/HTML. Sentences containing common limitations, uncertainty or team attribution are protected verbatim conservatively. The edited profile passes existing domain validation before rendering. The renderer continues to escape Markdown/HTML.

These are conservative tripwires, not semantic fact verification. An unsupported nonnumeric claim or a subtle change in meaning can still pass. Review rewritten claims against their source before using the CV. Successful edits record provider/model, `polish-cv-v1` or `tailor-cv-v1`, and `reviewRequired: true` in CV provenance; tailoring also records them in `matching.json`. Provenance identifies the original evidence, not independent verification of the rewritten claim.

Refusal, incomplete/malformed output, domain rejection and provider errors emit a fixed warning and retain the entire original deterministic CV. No failed editing metadata is recorded. Invalid provider configuration fails before generation. Tests use fictional transport/output fixtures; they do not establish live model quality.

For a manual quality check, use these fictional examples under `examples/software-engineer/`:

| Profile and job | Review focus |
| --- | --- |
| `profile.yaml` and `job.md` | Faithful problem/action/outcome rewrites and unchanged selected IDs. |
| `profile-v2.yaml` and `job.json` | The same factual preservation, with independent open-source summaries unchanged by polishing. |

Run each first offline and then with polishing enabled in separate output directories. Compare `cv.md`: every source fact, qualifier and attribution must remain intact, the selected IDs must match, and the edited version should read at least as well. Check that job requirements have not become candidate claims. Also compare general `build` with and without `--polish` using the same profile. Inspect `matching.json` for polishing metadata; its absence and a warning indicate fallback. No general evaluation service is needed.
