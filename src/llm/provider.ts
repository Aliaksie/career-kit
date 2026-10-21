import type { z } from 'zod';
export type GenerationRequest<T> = {
  name: string;
  instructions: string;
  input: unknown;
  user?: string;
  parameters?: { maxTokens: number; temperature?: number };
  schema: z.ZodType<T>;
};
export interface LanguageModel {
  readonly identity: { provider: string; model: string };
  generate<T>(request: GenerationRequest<T>): Promise<T>;
}
