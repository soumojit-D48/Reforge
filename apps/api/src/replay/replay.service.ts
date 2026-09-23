import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, ReplayOutcome, ReplayStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  REPLAY_EXECUTION_JOB_OPTIONS,
  REPLAY_EXECUTION_QUEUE,
  REPLAY_LOCK_TTL_SECONDS,
  type ReplayExecutionJob,
} from './replay.constants.js';
import { CreateReplayDto } from './dto/create-replay.dto.js';
import { resolveReplayFields } from './replay-resolution.js';

export interface ReplayView {
  id: string;
  sourceTraceId: string;
  resultTraceId: string | null;
  changedField: string;
  changedValue: unknown;
  fieldResolution: unknown;
  status: ReplayStatus;
  outcome: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SpanSource {
  id: string;
  type: string;
  name: string;
  model: string | null;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  arguments: Prisma.JsonValue | null;
  result: Prisma.JsonValue | null;
  error: Prisma.JsonValue | null;
  tokenUsage: Prisma.JsonValue | null;
  startedAt: Date;
  endedAt: Date | null;
}

interface TraceSource {
  id: string;
  name: string;
  status: string;
  totalDurationMs: number | null;
  totalCost: Prisma.Decimal | null;
  spans: SpanSource[];
}

interface ReplayComparisonSource {
  id: string;
  sourceTraceId: string;
  resultTraceId: string | null;
  changedField: string;
  fieldResolution: Prisma.JsonValue;
  status: ReplayStatus;
  outcome: ReplayOutcome | null;
  sourceTrace: TraceSource;
  resultTrace: TraceSource | null;
}

export interface ComparisonSpan {
  id: string;
  type: string;
  name: string;
  model: string | null;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  arguments: Prisma.JsonValue | null;
  result: Prisma.JsonValue | null;
  error: Prisma.JsonValue | null;
  tokenUsage: Prisma.JsonValue | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

export interface TraceComparison {
  id: string;
  name: string;
  status: string;
  finalOutput: Prisma.JsonValue | null;
  selectedTool: Prisma.JsonValue | null;
  toolArguments: Prisma.JsonValue | null;
  retrievalDocuments: Prisma.JsonValue | null;
  tokenUsage: Prisma.JsonValue[];
  cost: string | null;
  latencyMs: number | null;
  errors: Prisma.JsonValue[];
  spans: ComparisonSpan[];
}

export interface ReplayComparison {
  replay: {
    id: string;
    sourceTraceId: string;
    resultTraceId: string;
    status: ReplayStatus;
    outcome: ReplayOutcome | null;
    changedField: string;
    fieldResolution: Prisma.JsonValue;
  };
  original: TraceComparison;
  result: TraceComparison;
}

function durationMs(span: SpanSource): number | null {
  return span.endedAt === null
    ? null
    : Math.max(0, span.endedAt.getTime() - span.startedAt.getTime());
}

function objectValue(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : null;
}

function firstObjectValue(
  spans: SpanSource[],
  type: string,
  field: string,
): Prisma.JsonValue | null {
  for (const span of spans) {
    if (span.type !== type) continue;
    const output = objectValue(span.output);
    const value = output?.[field];
    if (value !== undefined) return value;
  }
  return null;
}

function traceComparison(trace: TraceSource): TraceComparison {
  const lastSpan = trace.spans.at(-1);
  return {
    id: trace.id,
    name: trace.name,
    status: trace.status,
    finalOutput: lastSpan?.output ?? lastSpan?.result ?? null,
    selectedTool:
      firstObjectValue(trace.spans, 'llm_call', 'tool_selected')
      ?? firstObjectValue(trace.spans, 'llm_call', 'toolSelected'),
    toolArguments: trace.spans.find((span) => span.type === 'tool_call')?.arguments ?? null,
    retrievalDocuments: firstObjectValue(trace.spans, 'retrieval', 'documents'),
    tokenUsage: trace.spans.flatMap((span) => span.tokenUsage === null ? [] : [span.tokenUsage]),
    cost: trace.totalCost?.toString() ?? null,
    latencyMs: trace.totalDurationMs,
    errors: trace.spans.flatMap((span) => span.error === null ? [] : [span.error]),
    spans: trace.spans.map((span) => ({
      id: span.id,
      type: span.type,
      name: span.name,
      model: span.model,
      input: span.input,
      output: span.output,
      arguments: span.arguments,
      result: span.result,
      error: span.error,
      tokenUsage: span.tokenUsage,
      startedAt: span.startedAt.toISOString(),
      endedAt: span.endedAt?.toISOString() ?? null,
      durationMs: durationMs(span),
    })),
  };
}

export function buildComparison(replay: ReplayComparisonSource): ReplayComparison {
  const resultTraceId = replay.resultTraceId;
  if (replay.resultTrace === null || resultTraceId === null) {
    throw new ConflictException('Replay result is not available yet');
  }
  return {
    replay: {
      id: replay.id,
      sourceTraceId: replay.sourceTraceId,
      resultTraceId,
      status: replay.status,
      outcome: replay.outcome,
      changedField: replay.changedField,
      fieldResolution: replay.fieldResolution,
    },
    original: traceComparison(replay.sourceTrace),
    result: traceComparison(replay.resultTrace),
  };
}

function toView(replay: {
  id: string;
  sourceTraceId: string;
  resultTraceId: string | null;
  changedField: string;
  changedValue: Prisma.JsonValue;
  fieldResolution: Prisma.JsonValue;
  status: ReplayStatus;
  outcome: string | null;
  createdAt: Date;
  completedAt: Date | null;
}): ReplayView {
  return {
    ...replay,
    createdAt: replay.createdAt.toISOString(),
    completedAt: replay.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ReplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(REPLAY_EXECUTION_QUEUE)
    private readonly queue: Queue<ReplayExecutionJob>,
  ) {}

  async create(traceId: string, dto: CreateReplayDto): Promise<ReplayView> {
    const source = await this.prisma.trace.findUnique({
      where: { id: traceId },
      select: { id: true },
    });
    if (source === null) {
      throw new NotFoundException('Trace not found');
    }

    const fieldResolution = resolveReplayFields(
      dto.changedField,
      dto.fieldResolution,
    );
    const owner = `replay:${traceId}`;
    if (
      !(await this.redis.acquireReplayLock(
        traceId,
        owner,
        REPLAY_LOCK_TTL_SECONDS,
      ))
    ) {
      throw new ConflictException('A replay is already running for this trace');
    }

    let replay: ReplayView;
    try {
      const created = await this.prisma.replay.create({
        data: {
          sourceTraceId: traceId,
          changedField: dto.changedField,
          changedValue: dto.changedValue as Prisma.InputJsonValue,
          fieldResolution: fieldResolution as Prisma.InputJsonValue,
        },
      });
      replay = toView(created);
      await this.queue.add(
        'execute-replay',
        { replayId: created.id },
        { ...REPLAY_EXECUTION_JOB_OPTIONS, jobId: created.id },
      );
    } catch (error) {
      await this.redis.releaseReplayLock(traceId, owner);
      throw error;
    }

    return replay;
  }

  async getById(replayId: string): Promise<ReplayView> {
    const replay = await this.prisma.replay.findUnique({
      where: { id: replayId },
    });
    if (replay === null) {
      throw new NotFoundException('Replay not found');
    }
    return toView(replay);
  }

  async compare(replayId: string): Promise<ReplayComparison> {
    const replay = await this.prisma.replay.findUnique({
      where: { id: replayId },
      include: {
        sourceTrace: { include: { spans: { orderBy: { startedAt: 'asc' } } } },
        resultTrace: { include: { spans: { orderBy: { startedAt: 'asc' } } } },
      },
    });
    if (replay === null) {
      throw new NotFoundException('Replay not found');
    }
    return buildComparison(replay);
  }

  async updateOutcome(replayId: string, outcome: ReplayOutcome): Promise<ReplayView> {
    const replay = await this.prisma.replay.findUnique({ where: { id: replayId } });
    if (replay === null) {
      throw new NotFoundException('Replay not found');
    }
    if (replay.status !== ReplayStatus.completed || replay.resultTraceId === null) {
      throw new ConflictException('Only completed replays can have an outcome');
    }
    const updated = await this.prisma.replay.update({
      where: { id: replayId },
      data: { outcome },
    });
    return toView(updated);
  }

  async markRunning(replayId: string): Promise<void> {
    await this.prisma.replay.update({
      where: { id: replayId },
      data: { status: ReplayStatus.running },
    });
  }

  async markCompleted(replayId: string, resultTraceId: string): Promise<void> {
    await this.prisma.replay.update({
      where: { id: replayId },
      data: {
        status: ReplayStatus.completed,
        resultTraceId,
        completedAt: new Date(),
      },
    });
  }

  async markFailed(replayId: string): Promise<void> {
    await this.prisma.replay.updateMany({
      where: { id: replayId },
      data: { status: ReplayStatus.failed, completedAt: new Date() },
    });
  }
}
