import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import * as ws from 'ws';

export const SUPABASE_CLIENT = 'SUPABASE_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: (config: ConfigService) =>
        createClient(
          config.get<string>('NEXT_PUBLIC_SUPABASE_URL'),
          config.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { realtime: { transport: ws as any } },
        ),
      inject: [ConfigService],
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
