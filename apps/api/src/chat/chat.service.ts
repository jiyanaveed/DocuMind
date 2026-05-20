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

export interface SendMessageResult {
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

  private buildAiMessages(
    systemContent: string,
    history: Message[],
    userMessage: string,
  ): ChatMessage[] {
    return [
      { role: 'system', content: systemContent },
      ...history.map((m): ChatMessage => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];
  }

  private buildSystemContent(sourceChunks: SourceChunk[]): string {
    const contextSection =
      sourceChunks.length > 0
        ? sourceChunks.map((c) => `[${c.document_title}]: ${c.content}`).join('\n\n')
        : 'No relevant context found in your documents.';

    return (
      `You are a helpful assistant. Answer the user's question using ONLY the context below. ` +
      `If the answer isn't in the context, say so. Cite which document each piece of information comes from.\n\n` +
      `Context:\n${contextSection}`
    );
  }

  private async loadHistory(conversationId: string): Promise<Message[]> {
    return this.db.query<Message>(
      `SELECT * FROM (
         SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10
       ) sub ORDER BY created_at ASC`,
      [conversationId],
    );
  }

  async sendMessage(userId: string, dto: ChatMessageDto): Promise<SendMessageResult> {
    const conversation = await this.createOrGetConversation(userId, dto.conversation_id, dto.message);
    const history = await this.loadHistory(conversation.id);

    await this.db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversation.id, 'user', dto.message],
    );

    const sourceChunks = await this.embeddingsService.similaritySearch(dto.message, userId, 5);
    const aiMessages = this.buildAiMessages(
      this.buildSystemContent(sourceChunks),
      history,
      dto.message,
    );

    const aiResponse = await this.aiProvider.chat(aiMessages);

    if (aiResponse.usage) {
      this.logger.log(`Saving token usage: prompt=${aiResponse.usage.prompt_tokens} completion=${aiResponse.usage.completion_tokens} total=${aiResponse.usage.total_tokens}`);
      this.db
        .query(
          `INSERT INTO token_usage
           (user_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            conversation.id,
            this.config.get('AI_MODEL') ?? 'gpt-4o-mini',
            aiResponse.usage.prompt_tokens,
            aiResponse.usage.completion_tokens,
            aiResponse.usage.total_tokens,
          ],
        )
        .catch((err) => this.logger.error('Failed to save token usage', err));
    }

    const assistantMessage = await this.db.queryOne<Message>(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [conversation.id, 'assistant', aiResponse.content],
    );

    return {
      message: assistantMessage!,
      source_chunks: sourceChunks,
      conversation_id: conversation.id,
    };
  }

  async *streamMessage(
    userId: string,
    dto: ChatMessageDto,
    onReady: (conversationId: string) => void,
  ): AsyncIterable<string> {
    const conversation = await this.createOrGetConversation(userId, dto.conversation_id, dto.message);
    const history = await this.loadHistory(conversation.id);

    await this.db.query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [conversation.id, 'user', dto.message],
    );

    const sourceChunks = await this.embeddingsService.similaritySearch(dto.message, userId, 5);
    const aiMessages = this.buildAiMessages(
      this.buildSystemContent(sourceChunks),
      history,
      dto.message,
    );

    onReady(conversation.id);

    let fullContent = '';
    try {
      for await (const chunk of this.aiProvider.chatStream(aiMessages, undefined, (usage) => {
        this.logger.log(`Saving token usage: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens}`);
        this.db
          .query(
            `INSERT INTO token_usage
             (user_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              userId,
              conversation.id,
              this.config.get('AI_MODEL') ?? 'gpt-4o-mini',
              usage.prompt_tokens,
              usage.completion_tokens,
              usage.total_tokens,
            ],
          )
          .catch((err) => this.logger.error('Failed to save token usage', err));
      })) {
        fullContent += chunk;
        yield chunk;
      }
    } finally {
      if (fullContent) {
        await this.db.queryOne<Message>(
          'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
          [conversation.id, 'assistant', fullContent],
        );
      }
    }
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
