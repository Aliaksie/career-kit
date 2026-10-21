import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLanguageModel } from '../src/llm/sdk.js';

it('validates explicit provider configuration without sending requests', () => {
  const transport = vi.fn<typeof fetch>();
  for (const provider of ['openai', 'anthropic', 'google']) {
    expect(() => createLanguageModel({ provider, model: 'test' }, {}, transport)).toThrow('required');
    expect(createLanguageModel({ provider, model: 'test', apiKeyEnv: 'CUSTOM_KEY' }, { CUSTOM_KEY: 'fixture' }, transport).identity).toEqual({ provider, model: 'test' });
  }
  for (const config of [
    { provider: 'unknown', model: 'test' }, { provider: 'openai', model: ' ' },
    { provider: 'openai-compatible', model: 'test' },
    { provider: 'openai', model: 'test', endpoint: 'file:///secret' },
    { provider: 'openai', model: 'test', endpoint: 'https://user:secret@example.test' },
    { provider: 'openai', model: 'test', apiKeyEnv: 'invalid-key' },
  ]) expect(() => createLanguageModel(config, { OPENAI_API_KEY: 'fixture' }, transport)).toThrow();
  expect(transport).not.toHaveBeenCalled();
});

it('uses a compatible endpoint with environment credentials and strict schema output', async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    id: 'fixture', created: 0, model: 'local-model', object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: '{"accepted":true}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
  const model = createLanguageModel({ provider: 'openai-compatible', model: 'local-model', endpoint: 'http://localhost:1234/v1' }, { LLM_API_KEY: 'fixture-key' }, transport);
  expect(await model.generate({ name: 'test', instructions: 'Use supplied facts only.', input: { safe: true }, schema: z.strictObject({ accepted: z.boolean() }) })).toEqual({ accepted: true });
  const [url, options] = transport.mock.calls[0];
  expect(String(url)).toBe('http://localhost:1234/v1/chat/completions');
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-key');
  const body = JSON.parse(options!.body as string);
  expect(body.messages).toEqual([{ role: 'system', content: 'Use supplied facts only.' }, { role: 'user', content: '{"safe":true}' }]);
  expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'test', schema: { additionalProperties: false } } });
  expect(transport).toHaveBeenCalledOnce();
});

it('allows an unauthenticated local compatible endpoint', () => {
  expect(createLanguageModel({ provider: 'openai-compatible', model: 'local', endpoint: 'http://localhost:1234/v1' }, {}).identity.provider).toBe('openai-compatible');
});
