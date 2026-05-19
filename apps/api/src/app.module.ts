import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthController } from './health/health.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    DatabaseModule,
    AuthModule,
    DocumentsModule,
    ChatModule,
    UploadModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
