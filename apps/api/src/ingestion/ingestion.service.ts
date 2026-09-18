import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, SpanType, TraceStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { ApiKeyRequestContext } from '../common/guards/api-key.guard.js';
import {
  TRACE_PROCESSING_JOB_OPTIONS,
  TRACE_PROCESSING_QUEUE,
  type TraceProcessingJob,
} from './ingestion.constants.js';
import type { IngestTraceDto } from './dto/ingest-trace.dto.js';

export interface IngestResult {
  traceId: string;
  duplicate: boolean;
}

/**
 * Prisma Json columns accept only plain JSON. DTO free-form fields arrive
 * as class instances (e.g. TokenUsageDto) or arbitrary values — normalize
 * through a JSON round-trip at the persistence boundary.
 */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @InjectQueue(TRACE_PROCESSING_QUEUE)
    private readonly traceQueue: Queue<TraceProcessingJob>,
  ) {}

  async ingest(
    apiKey: ApiKeyRequestContext,
    dto: IngestTraceDto,
  ): Promise<IngestResult> {
    const { projectId } = apiKey;

    // Abuse protection first: cheap counter before any expensive work.
    const maxRequests = this.rateLimitMax();
    const count = await this.redis.incrementRateLimit(projectId);
    if (count > maxRequests) {
      throw new HttpException(
        `Ingestion rate limit exceeded (${maxRequests}/min per project)`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ARCH §4: spans without a trace start timestamp are unprocessable.
    if (
      (dto.spans?.length ?? 0) > 0 &&
      (dto.startedAt === undefined || dto.startedAt === '')
    ) {
      throw new BadRequestException(
        'trace.started_at is required when spans are present',
      );
    }

    // Idempotency fast path: same external_id already accepted → same id.
    if (dto.externalId !== undefined && dto.externalId !== '') {
      const seen = await this.redis.getIdempotencyRecord(
        projectId,
        dto.externalId,
      );
      if (seen !== null) {
        return { traceId: seen, duplicate: true };
      }
    }

    // Persist first so the worker can never find a missing trace; the DB
    // unique constraint backs Redis as the dedupe source of truth.
    let traceId: string;
    try {
      traceId = await this.persistTrace(projectId, dto);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        dto.externalId !== undefined &&
        dto.externalId !== ''
      ) {
        // Lost the insert race (or Redis key expired): the trace exists —
        // resolve it and answer as a duplicate, never a 409 to a retry.
        const existing = await this.prisma.trace.findUnique({
          where: {
            projectId_externalId: {
              projectId,
              externalId: dto.externalId,
            },
          },
          select: { id: true },
        });
        if (existing === null) {
          throw new ConflictException(
            'Duplicate trace: this external_id was already ingested',
          );
        }
        return { traceId: existing.id, duplicate: true };
      }
      throw err;
    }

    if (dto.externalId !== undefined && dto.externalId !== '') {
      await this.redis.setIdempotencyRecord(projectId, dto.externalId, traceId);
    }

    try {
      await this.traceQueue.add(
        'process',
        { traceId },
        TRACE_PROCESSING_JOB_OPTIONS,
      );
    } catch (err) {
      // Enqueue failure must fail the request loudly (503), never accept
      // a trace that will sit unprocessed with no visible state.
      this.logger.error(
        `Failed to enqueue trace-processing job for ${traceId}: ${(err as Error).message}`,
      );
      throw new HttpException(
        'Trace accepted but processing could not be scheduled — retry the request',
        503,
      );
    }

    return { traceId, duplicate: false };
  }

  private rateLimitMax(): number {
    const raw = this.config.get<string>('RATELIMIT_MAX_REQUESTS');
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 100;
  }

  private async persistTrace(
    projectId: string,
    dto: IngestTraceDto,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const trace = await tx.trace.create({
        data: {
          projectId,
          externalId: dto.externalId,
          name: dto.name,
          environment: dto.environment,
          // The client-reported state is the starting point: the worker
          // only ever escalates to failed/processing_error, never rewrites
          // it. Hardcoding 'running' here stranded success traces forever.
          status: dto.status as TraceStatus,
          input: toJson(dto.input),
          metadata: toJson(dto.metadata),
          startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
          endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
        },
      });

      // Two-phase span insert: client ids are transient, so create all rows
      // first, then resolve parent_id through the client→db id map.
      const dbIdByClientId = new Map<string, string>();
      for (const span of dto.spans ?? []) {
        const created = await tx.span.create({
          data: {
            traceId: trace.id,
            type: span.type as SpanType,
            name: span.name,
            model: span.model,
            promptVersion: span.promptVersion,
            input: toJson(span.input),
            output: toJson(span.output),
            arguments: toJson(span.arguments),
            result: toJson(span.result),
            error: toJson(span.error),
            tokenUsage: toJson(span.tokenUsage),
            startedAt: new Date(span.startedAt),
            endedAt: span.endedAt ? new Date(span.endedAt) : undefined,
          },
        });
        if (span.id !== undefined) {
          dbIdByClientId.set(span.id, created.id);
        }
      }
      for (const span of dto.spans ?? []) {
        if (span.parentId === undefined || span.id === undefined) {
          continue;
        }
        const parentDbId = dbIdByClientId.get(span.parentId);
        const childDbId = dbIdByClientId.get(span.id);
        // Tree validator guarantees both resolve; guard anyway — a silent
        // skip here would corrupt the timeline M3 renders.
        if (parentDbId === undefined || childDbId === undefined) {
          throw new BadRequestException(
            `Unresolvable span parent reference for "${span.id}"`,
          );
        }
        await tx.span.update({
          where: { id: childDbId },
          data: { parentId: parentDbId },
        });
      }
      return trace.id;
    });
  }
}
