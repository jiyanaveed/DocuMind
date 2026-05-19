export interface User {
  id: string;
  email: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DocChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  embedding?: number[];
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  source_chunks?: DocChunk[];
}

export interface CreateDocumentDto {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateDocumentDto {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface ChatMessageDto {
  conversation_id?: string;
  message: string;
}

export interface AIProviderConfig {
  provider: 'openai' | 'groq' | 'ollama' | 'together';
  baseURL: string;
  apiKey: string;
  model: string;
  embeddingModel: string;
}
