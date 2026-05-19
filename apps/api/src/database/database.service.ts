import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';

@Injectable()
export class DatabaseService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.pool.query(sql, params);
    return (result.rows[0] as T) ?? null;
  }
}
