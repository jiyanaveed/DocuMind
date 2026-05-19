import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { registerTypes } from 'pgvector/pg';
import { PG_POOL } from './database.constants';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (config: ConfigService) => {
        const pool = new Pool({
          connectionString: config.get<string>('DATABASE_URL'),
          ssl: { rejectUnauthorized: false },
        });

        pool.on('connect', (client) => {
          registerTypes(client).catch((err) =>
            console.error('Failed to register pgvector types:', err),
          );
        });

        return pool;
      },
      inject: [ConfigService],
    },
    DatabaseService,
  ],
  exports: [PG_POOL, DatabaseService],
})
export class DatabaseModule {}
