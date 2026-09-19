import {
  ForbiddenException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { ReforgeLogger } from './common/logging/reforge-logger.js';

function parseOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return ['http://localhost:3000'];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

async function bootstrap(): Promise<void> {
  const logger = new ReforgeLogger();
  const app = await NestFactory.create(AppModule, { logger });
  const config = app.get(ConfigService);

  // the default; only health opts out via VERSION_NEUTRAL.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Ingestion payloads are the largest bodies we accept — cap JSON parsing
  // globally (default 1mb, env-overridable); oversize → 413 via the filter.
  app.use(json({ limit: config.get<string>('JSON_BODY_LIMIT') ?? '1mb' }));

  const allowlist = parseOrigins(config.get<string>('WEB_ORIGINS'));
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (origin === undefined || allowlist.includes(origin)) {
        callback(null, true);
      } else {
        // ForbiddenException (not Error) so the rejection flows through the
        // GlobalExceptionFilter as a 403 envelope instead of a 500 + error log.
        callback(new ForbiddenException(`Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Reforge API')
    .setDescription('AI agent failure investigation & replay platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(parsePort(config.get<string>('PORT')));

function parsePort(raw: string | undefined): number {
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(parsed) ? parsed : 3001;
}
}
void bootstrap();
