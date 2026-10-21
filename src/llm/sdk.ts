import { generateText, Output, type LanguageModel as SDKLanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { GenerationRequest, LanguageModel } from './provider.js';

export type ModelConfiguration = {
  provider: string;
  model: string;
  endpoint?: string;
  apiKeyEnv?: string;
};
const keyVariables: Record<string, string> = {
  openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY', 'openai-compatible': 'LLM_API_KEY',
};

export class SDKProvider implements LanguageModel {
  constructor(readonly identity: { provider: string; model: string }, private readonly model: SDKLanguageModel) {}
  async generate<T>(request: GenerationRequest<T>): Promise<T> {
    const input = JSON.stringify(request.input);
    if (Buffer.byteLength(input) > 64_000) throw new Error('Polishing input exceeds 64000 bytes; reduce the achievement limit');
    try {
      const result = await generateText({
        model: this.model, system: request.instructions, prompt: input,
        output: Output.object({ schema: request.schema, name: request.name }),
        maxOutputTokens: 4096, maxRetries: 0, abortSignal: AbortSignal.timeout(30_000),
        providerOptions: this.identity.provider === 'openai' ? { openai: { store: false } } : undefined,
      });
      if (result.finishReason !== 'stop') throw new Error('Incomplete output');
      return request.schema.parse(result.output);
    } catch {
      // Provider errors may include credentials, endpoints or disclosed statements.
      throw new Error('AI provider failed or returned invalid structured output');
    }
  }
}

export function createLanguageModel(config: ModelConfiguration, env: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch): LanguageModel {
  if (!Object.hasOwn(keyVariables, config.provider)) throw new Error('Supported providers: openai, anthropic, google, openai-compatible');
  if (!config.model.trim()) throw new Error('An explicit model is required');
  if (config.endpoint) {
    let url: URL;
    try { url = new URL(config.endpoint); } catch { throw new Error('Endpoint must be an HTTP(S) URL'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Endpoint must be an HTTP(S) URL without credentials, query or fragment');
    }
  }
  if (config.provider === 'openai-compatible' && !config.endpoint) throw new Error('An endpoint is required for openai-compatible');
  const keyVariable = config.apiKeyEnv ?? keyVariables[config.provider];
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyVariable)) throw new Error('API key environment variable name is invalid');
  const apiKey = env[keyVariable]?.trim();
  if (!apiKey && (config.provider !== 'openai-compatible' || config.apiKeyEnv)) throw new Error(`${keyVariable} is required for AI polishing`);
  const settings = {
    apiKey, baseURL: config.endpoint,
    fetch: ((input, init) => transport(input, { ...init, redirect: 'error' })) as typeof fetch,
  };
  let model: SDKLanguageModel;
  switch (config.provider) {
    case 'openai': model = createOpenAI(settings).responses(config.model); break;
    case 'anthropic': model = createAnthropic(settings)(config.model); break;
    case 'google': model = createGoogleGenerativeAI(settings)(config.model); break;
    default: model = createOpenAICompatible({ ...settings, baseURL: config.endpoint!, name: 'openai-compatible', supportsStructuredOutputs: true })(config.model);
  }
  return new SDKProvider({ provider: config.provider, model: config.model }, model);
}
