import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDocumentDto, Document, UpdateDocumentDto } from '@repo/types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(userId: string): Promise<Document[]> {
    return this.db.query<Document>(
      'SELECT * FROM documents WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    );
  }

  async findOne(id: string, userId: string): Promise<Document> {
    const doc = await this.db.queryOne<Document>(
      'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async create(userId: string, dto: CreateDocumentDto): Promise<Document> {
    const doc = await this.db.queryOne<Document>(
      'INSERT INTO documents (user_id, title, content, tags) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, dto.title, dto.content, dto.tags ?? []],
    );
    return doc!;
  }

  async update(id: string, userId: string, dto: UpdateDocumentDto): Promise<Document> {
    const existing = await this.findOne(id, userId);

    const doc = await this.db.queryOne<Document>(
      'UPDATE documents SET title=$1, content=$2, tags=$3, updated_at=NOW() WHERE id=$4 AND user_id=$5 RETURNING *',
      [
        dto.title ?? existing.title,
        dto.content ?? existing.content,
        dto.tags ?? existing.tags,
        id,
        userId,
      ],
    );
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.db.query('DELETE FROM doc_chunks WHERE document_id = $1', [id]);
    await this.db.query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [id, userId]);
  }
}
