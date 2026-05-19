import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAIProvider } from '@repo/ai-provider';
import type { AIProvider } from '@repo/ai-provider';
import type { AIProviderConfig } from '@repo/types';
import { Document } from '@repo/types';
import { toSql } from 'pgvector/pg';
import { DatabaseService } from '../database/database.service';

interface ChunkRow {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  document_title: string;
  similarity: number;
}

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private aiProvider: AIProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
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

  async processDocument(doc: Document): Promise<void> {
    try {
      // Step 1 — Remove stale chunks
      await this.db.query('DELETE FROM doc_chunks WHERE document_id = $1', [doc.id]);

      // Step 2 — Chunk content
      const chunks = this.chunkText(doc.content);
      if (chunks.length === 0) {
        this.logger.warn(`No chunks generated for document ${doc.id}`);
        return;
      }

      this.logger.log(`Embedding document ${doc.id}: ${chunks.length} chunks`);

      // Steps 3 & 4 — Embed and insert each chunk
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.aiProvider.embed(chunks[i]);
        await this.db.query(
          'INSERT INTO doc_chunks (document_id, content, chunk_index, embedding) VALUES ($1, $2, $3, $4::vector)',
          [doc.id, chunks[i], i, toSql(embedding)],
        );
      }

      this.logger.log(`Finished embedding document ${doc.id}`);
    } catch (err) {
      this.logger.error(`Failed to embed document ${doc.id}`, err);
    }
  }

  async similaritySearch(query: string, userId: string, limit = 5): Promise<ChunkRow[]> {
    const queryEmbedding = await this.aiProvider.embed(query);

    return this.db.query<ChunkRow>(
      `SELECT dc.id,
              dc.document_id,
              dc.content,
              dc.chunk_index,
              d.title AS document_title,
              1 - (dc.embedding <=> $1::vector) AS similarity
       FROM doc_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE d.user_id = $2
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      [toSql(queryEmbedding), userId, limit],
    );
  }

  private chunkText(text: string): string[] {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    // Flatten paragraphs into individual sentences
    const sentences: string[] = [];
    for (const para of paragraphs) {
      const paraSentences = para
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      sentences.push(...paraSentences);
    }

    if (sentences.length === 0) return text.trim() ? [text.trim()] : [];

    const MAX_WORDS = 500;
    const MIN_WORDS = 100;

    const chunks: string[] = [];
    let current: string[] = [];
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).filter(Boolean).length;

      if (currentWordCount + wordCount > MAX_WORDS && currentWordCount >= MIN_WORDS) {
        chunks.push(current.join(' '));
        // 1-sentence overlap: carry the last sentence of the current chunk forward
        const overlap = current[current.length - 1];
        current = [overlap, sentence];
        currentWordCount = overlap.split(/\s+/).filter(Boolean).length + wordCount;
      } else {
        current.push(sentence);
        currentWordCount += wordCount;
      }
    }

    if (current.length > 0) {
      const tail = current.join(' ');
      if (currentWordCount >= MIN_WORDS) {
        chunks.push(tail);
      } else if (chunks.length > 0) {
        // Absorb short tail into the last chunk rather than create a tiny orphan
        chunks[chunks.length - 1] += ' ' + tail;
      } else {
        chunks.push(tail);
      }
    }

    return chunks;
  }
}
