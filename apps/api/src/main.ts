import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'https://docu-mind-web-kappa.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin ?? true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
