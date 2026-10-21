import { createLanguageModel } from './sdk.js';
import type { GenerationRequest, LanguageModel } from './provider.js';

// Retain the existing internal adapter entry point while sharing SDK transport.
export class OpenAIProvider implements LanguageModel {
  readonly identity: { provider: string; model: string };
  private readonly delegate: LanguageModel;
  constructor(apiKey: string, model: string, transport: typeof fetch = fetch) {
    this.delegate = createLanguageModel({ provider: 'openai', model }, { OPENAI_API_KEY: apiKey }, transport);
    this.identity = this.delegate.identity;
  }
  generate<T>(request: GenerationRequest<T>): Promise<T> { return this.delegate.generate(request); }
}
