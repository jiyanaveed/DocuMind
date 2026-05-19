import type { AIProviderConfig } from '@repo/types';
import { OpenAIProvider } from './openai-provider';
import type { AIProvider } from './types';

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  ollama: 'http://localhost:11434/v1',
  together: 'https://api.together.xyz/v1',
};

export function createAIProvider(config: AIProviderConfig): AIProvider {
  const baseURL = config.baseURL || PROVIDER_BASE_URLS[config.provider] || PROVIDER_BASE_URLS.openai;
  return new OpenAIProvider(baseURL, config.apiKey, config.model, config.embeddingModel);
}
