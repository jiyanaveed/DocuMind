import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Strip unknown fields and auto-transform primitives (e.g. "true" → true)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Unified error shape: { statusCode, message, timestamp, path }
  app.useGlobalFilters(new AllExceptionsFilter());

  // TODO(production): add rate limiting via @nestjs/throttler
  //   import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
  //   In AppModule.imports: ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])
  //   app.useGlobalGuards(new ThrottlerGuard());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}

bootstrap();
