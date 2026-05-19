import OpenAI from 'openai';
import type { AIProvider, ChatMessage, ChatOptions } from './types';

export class OpenAIProvider implements AIProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(baseURL: string, apiKey: string, model: string, embeddingModel: string) {
    this.client = new OpenAI({ baseURL, apiKey });
    this.model = model;
    this.embeddingModel = embeddingModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return response.data[0].embedding;
  }
}
