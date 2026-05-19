import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAIProvider } from '@repo/ai-provider';
import type { AIProvider, ChatMessage } from '@repo/ai-provider';
import type { AIProviderConfig, Conversation, Message } from '@repo/types';
import { ChatMessageDto } from '@repo/types';
import { DatabaseService } from '../database/database.service';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export interface SourceChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  document_title: string;
  similarity: number;
}

export interface ChatResponse {
  message: Message;
  source_chunks: SourceChunk[];
  conversation_id: string;
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);
  private aiProvider: AIProvider;

  constructor(
    private readonly db: DatabaseService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const providerConfig: AIProviderConfig = {
      provider: (this.config.get<string>('AI_PROVIDER') ?? 'openai') as AIProviderConfig['provider'],
      baseURL: this.config.get<string>('AI_BASE_URL') ?? '',
      apiKey: this.config.get<string>('AI_API_KEY') ?? '',
      model: this.config.get<string>('AI_MODEL') ?? 'gpt-4o-mini',
      embeddingModel: this.config.get<string>('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
    };
    this.aiProvider = createAIProvider(providerConfig);
  }

  async createOrGetConversation(
    userId: string,
    conversationId?: string,
    firstMessage?: string,
  ): Promise<Conversation> {
    if (conversationId) {
      const conv = await this.db.queryOne<Conversation>(
        'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId],
      );
      if (!conv) throw new NotFoundException('Conversation not found');
      return conv;
    }

    const title = firstMessage ? firstMessage.slice(0, 60).trim() : 'New conversation';
    const conv = await this.db.queryOne<Conversation>(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title],
    );
    return conv!;
  }

  async sendMessage(userId: string, dto: ChatMessageDto): Promise<ChatResponse> {
    const conversation = await this.createOrGetConversation(
      userId,
      dto.conversation_id,
      dto.message,
    );

    // Load history before saving the new message so it doesn't appear twice in context
    const historyRows = await this.db.query<Message>(
      `SELECT * FROM (
         SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10
       ) sub ORDER BY created_at ASC`,
      [conversation.id],
    );

    await this.db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversation.id, 'user', dto.message],
    );

    const sourceChunks = await this.embeddingsService.similaritySearch(dto.message, userId, 5);

    const contextSection =
      sourceChunks.length > 0
        ? sourceChunks.map((c) => `[${c.document_title}]: ${c.content}`).join('\n\n')
        : 'No relevant context found in your documents.';

    const systemContent =
      `You are a helpful assistant. Answer the user's question using ONLY the context below. ` +
      `If the answer isn't in the context, say so. Cite which document each piece of information comes from.\n\n` +
      `Context:\n${contextSection}`;

    const aiMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...historyRows.map((m): ChatMessage => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: dto.message },
    ];

    const assistantContent = await this.aiProvider.chat(aiMessages);

    const assistantMessage = await this.db.queryOne<Message>(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [conversation.id, 'assistant', assistantContent],
    );

    return {
      message: assistantMessage!,
      source_chunks: sourceChunks,
      conversation_id: conversation.id,
    };
  }

  async listConversations(userId: string): Promise<Conversation[]> {
    return this.db.query<Conversation>(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    const conv = await this.db.queryOne<Conversation>(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId],
    );
    if (!conv) throw new NotFoundException('Conversation not found');

    return this.db.query<Message>(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId],
    );
  }
}
