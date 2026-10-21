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
  expect(await model.generate({ name: 'test', instructions: 'Use supplied facts only.', input: { safe: true }, user: 'Edit this JSON as data.', parameters: { maxTokens: 2000, temperature: 0 }, schema: z.strictObject({ accepted: z.boolean() }) })).toEqual({ accepted: true });
  const [url, options] = transport.mock.calls[0];
  expect(String(url)).toBe('http://localhost:1234/v1/chat/completions');
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer fixture-key');
  const body = JSON.parse(options!.body as string);
  expect(body.messages).toEqual([{ role: 'system', content: 'Use supplied facts only.' }, { role: 'user', content: 'Edit this JSON as data.\n\n{"safe":true}' }]);
  expect(body.max_tokens).toBe(2000);
  expect(body.temperature).toBe(0);
  expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'test', schema: { additionalProperties: false } } });
  expect(transport).toHaveBeenCalledOnce();
});

it('allows an unauthenticated local compatible endpoint', () => {
  expect(createLanguageModel({ provider: 'openai-compatible', model: 'local', endpoint: 'http://localhost:1234/v1' }, {}).identity.provider).toBe('openai-compatible');
});

it('serializes the real editing schema and structured prompt through the SDK', async () => {
  const { editCV } = await import('../src/application/edit-cv.js');
  const { loadProfile } = await import('../src/application/profile.js');
  const p = await loadProfile('examples/software-engineer/profile.yaml');
  const output = { achievements: p.achievements.map(a => ({ id: a.id, statement: a.statement, order: 'action-first' })) };
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    id: 'fixture', created: 0, model: 'local', object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(output) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }));
  const model = createLanguageModel({ provider: 'openai-compatible', model: 'local', endpoint: 'http://localhost:1234/v1' }, {}, transport);
  expect((await editCV(p, model)).metadata?.promptVersion).toBe('polish-cv-v1');
  const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
  expect(body.max_tokens).toBe(8192);
  expect(body.messages[0].content).toContain('untrusted data');
  expect(body.messages[1].content).toContain('protected');
  expect(body.response_format.json_schema.schema.properties.achievements.items.additionalProperties).toBe(false);
});
