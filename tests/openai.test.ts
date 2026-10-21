import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenAIProvider } from '../src/llm/openai.js';
const request = { name: 'test', instructions: 'Use supplied facts only.', input: { safe: true }, schema: z.strictObject({ accepted: z.boolean() }) };
const complete = (text: string) => ({ id: 'resp_fixture', created_at: 0, model: 'explicit-model', status: 'completed', output: [{ id: 'msg_fixture', role: 'assistant', status: 'completed', type: 'message', content: [{ type: 'output_text', text, annotations: [] }] }] });
it('uses Responses strict structured output, validates the result and bounds the request', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(complete('{"accepted":true}')));
  const provider = new OpenAIProvider('fixture-key', 'explicit-model', transport);
  expect(await provider.generate(request)).toEqual({ accepted: true });
  const [url, options] = transport.mock.calls[0];
  expect(url).toBe('https://api.openai.com/v1/responses');
  const body = JSON.parse(options!.body as string);
  expect(body.model).toBe('explicit-model');
  expect(body.store).toBe(false);
  expect(body.max_output_tokens).toBe(4096);
  expect(body.text.format).toMatchObject({ type: 'json_schema', name: 'test', strict: true, schema: { additionalProperties: false } });
  expect(body).not.toHaveProperty('tools');
  expect(options!.redirect).toBe('error');
  expect(options!.signal).toBeInstanceOf(AbortSignal);
});
it('rejects missing credentials/model, oversized input, refusal, truncation, malformed output and HTTP failures', async () => {
  expect(() => new OpenAIProvider('', 'model')).toThrow('OPENAI_API_KEY');
  expect(() => new OpenAIProvider('key', '')).toThrow('explicit');
  const noCall = vi.fn<typeof fetch>();
  await expect(new OpenAIProvider('key', 'model', noCall).generate({ ...request, input: 'x'.repeat(64_001) })).rejects.toThrow('64000');
  expect(noCall).not.toHaveBeenCalled();
  for (const output of [
    { ...complete('{"accepted":true}'), status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
    { ...complete(''), output: [{ id: 'msg_refusal', role: 'assistant', status: 'completed', type: 'message', content: [{ type: 'refusal', refusal: 'Cannot comply.' }] }] },
    complete('{"accepted":"invented","extra":true}'),
    complete('invalid JSON'),
  ]) {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(output));
    await expect(new OpenAIProvider('key', 'model', transport).generate(request)).rejects.toThrow('invalid structured output');
    expect(transport).toHaveBeenCalledOnce();
  }
  const fail = vi.fn<typeof fetch>().mockResolvedValue(new Response('do not echo provider body or secrets', { status: 429 }));
  await expect(new OpenAIProvider('key', 'model', fail).generate(request)).rejects.toThrow('invalid structured output');
  expect(fail).toHaveBeenCalledOnce();
  const timeout = vi.fn<typeof fetch>().mockRejectedValue(new Error('SECRET'));
  await expect(new OpenAIProvider('key', 'model', timeout).generate(request)).rejects.toThrow('invalid structured output');
});
