import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeyGuard, type ApiKeyRequestContext } from '../common/guards/api-key.guard.js';
import { IngestTraceDto } from './dto/ingest-trace.dto.js';
import { IngestionService, type IngestResult } from './ingestion.service.js';

@ApiTags('ingestion')
@ApiSecurity('api-key')
@Controller('ingest')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  // SDK ingestion: API-key auth only, never JWT. Accepts fast (202) and
  // processes in the background (NFR-1) — the worker owns slow work.
  @UseGuards(ApiKeyGuard)
  @Post('trace')
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(
    @Req() req: Request & { apiKey?: ApiKeyRequestContext },
    @Body() dto: IngestTraceDto,
  ): Promise<IngestResult> {
    const apiKey = req.apiKey;
    if (apiKey === undefined) {
      // Unreachable when the guard runs — defensive against future
      // refactors that reorder or drop @UseGuards on this route.
      throw new InternalServerErrorException(
        'API key context missing: ApiKeyGuard did not run',
      );
    }
    return this.ingestion.ingest(apiKey, dto);
  }
}
