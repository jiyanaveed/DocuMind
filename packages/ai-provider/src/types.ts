export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIChatResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type UsageData = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export interface AIProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIChatResponse>;
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
    onUsage?: (usage: UsageData) => void,
  ): AsyncIterable<string>;
  embed(text: string): Promise<number[]>;
}
