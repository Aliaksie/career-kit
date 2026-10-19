import { z } from 'zod';
import type { GenerationRequest, LanguageModel } from './provider.js';

const envelopeSchema = z.object({
  status: z.literal('completed'),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});
export class OpenAIProvider implements LanguageModel {
  readonly identity: { provider: string; model: string };
  constructor(private readonly apiKey: string, model: string, private readonly transport: typeof fetch = fetch) {
    if (!apiKey.trim()) throw new Error('OPENAI_API_KEY is required for OpenAI polishing');
    if (!model.trim()) throw new Error('An explicit OpenAI model is required');
    this.identity = { provider: 'openai', model };
  }
  async generate<T>(request: GenerationRequest<T>): Promise<T> {
    const input = JSON.stringify(request.input);
    if (Buffer.byteLength(input) > 64_000) throw new Error('Polishing input exceeds 64000 bytes; reduce the achievement limit');
    const schema = z.toJSONSchema(request.schema, { target: 'draft-7' });
    delete schema.$schema;
    let response: Response;
    try {
      response = await this.transport('https://api.openai.com/v1/responses', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.identity.model, store: false,
          instructions: request.instructions, input, max_output_tokens: 4096,
          text: { format: { type: 'json_schema', name: request.name, strict: true,
            schema } },
        }),
      });
    } catch { throw new Error('OpenAI request failed or timed out; no artifacts were written'); }
    if (!response.ok) throw new Error(`OpenAI request failed (HTTP ${response.status}); no artifacts were written`);
    try {
      const envelope = envelopeSchema.parse(await response.json());
      const content = envelope.output.filter(item => item.type === 'message').flatMap(item => item.content ?? []);
      if (content.some(item => item.type === 'refusal')) throw new Error('refusal');
      const texts = content.filter(item => item.type === 'output_text');
      if (texts.length !== 1 || !texts[0].text) throw new Error('missing output');
      return request.schema.parse(JSON.parse(texts[0].text));
    } catch { throw new Error('OpenAI returned refused, incomplete or invalid structured output; no artifacts were written'); }
  }
}
