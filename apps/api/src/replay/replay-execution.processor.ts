import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Prisma, SpanType } from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import { OpenRouterService } from '../ai/openrouter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  REPLAY_EXECUTION_JOB_OPTIONS,
  REPLAY_EXECUTION_QUEUE,
  type ReplayExecutionJob,
} from './replay.constants.js';
import { ReplayService } from './replay.service.js';
import {
  type ReplayResolution,
} from './replay-resolution.js';
import { REALTIME_EVENTS, type SpanCreatedPayload } from '../realtime/realtime.constants.js';
import { RealtimeService } from '../realtime/realtime.service.js';

function jsonText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}

type ReplayWithSource = Prisma.ReplayGetPayload<{
  include: { sourceTrace: { include: { spans: true } } };
}>;

@Processor(REPLAY_EXECUTION_QUEUE)
export class ReplayExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ReplayExecutionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly replays: ReplayService,
    private readonly ai: OpenRouterService,
    private readonly realtime: RealtimeService,
  ) {
    super();
  }

  async process(job: Job<ReplayExecutionJob>): Promise<void> {
    const replay = await this.prisma.replay.findUnique({
      where: { id: job.data.replayId },
      include: { sourceTrace: { include: { spans: true } } },
    });
    if (replay === null) {
      throw new UnrecoverableError(`Replay ${job.data.replayId} not found`);
    }

    const lockOwner = `replay:${replay.sourceTraceId}`;
    let terminalFailure = false;
    try {
      await this.replays.markRunning(replay.id);
      this.realtime.emitToProject(
        replay.sourceTrace.projectId,
        REALTIME_EVENTS.replayProgress,
        { replayId: replay.id, step: 'replay', status: 'running' },
      );
      const resultTraceId = await this.execute(replay, lockOwner);
      await this.replays.markCompleted(replay.id, resultTraceId);
      this.realtime.emitToProject(
        replay.sourceTrace.projectId,
        REALTIME_EVENTS.replayCompleted,
        { replayId: replay.id, resultTraceId },
      );
    } catch (error) {
      const attempts = REPLAY_EXECUTION_JOB_OPTIONS.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts || error instanceof UnrecoverableError) {
        terminalFailure = true;
        await this.prisma.trace.deleteMany({
          where: {
            metadata: {
              path: ['replayId'],
              equals: replay.id,
            },
          },
        });
        await this.replays.markFailed(replay.id);
        this.realtime.emitToProject(
          replay.sourceTrace.projectId,
          REALTIME_EVENTS.replayProgress,
          { replayId: replay.id, step: 'replay', status: 'failed' },
        );
        this.logger.error(
          `replay-execution failed permanently for ${replay.id}: ${(error as Error).message}`,
        );
      }
      throw error;
    } finally {
      if (
        terminalFailure ||
        job.attemptsMade + 1 >= (REPLAY_EXECUTION_JOB_OPTIONS.attempts ?? 1) ||
        (await this.prisma.replay.findUnique({ where: { id: replay.id }, select: { status: true } }))?.status === 'completed'
      ) {
        await this.redis.releaseReplayLock(replay.sourceTraceId, lockOwner);
      }
    }
  }

  private async execute(
    replay: ReplayWithSource,
    _lockOwner: string,
  ): Promise<string> {
    if (replay === null) {
      throw new UnrecoverableError('Replay source not found');
    }
    const resolution = replay.fieldResolution as unknown as ReplayResolution;
    const freshFields = Object.entries(resolution)
      .filter(([, value]) => value === 'fresh')
      .map(([field]) => field);
    if (freshFields.length > 0) {
      throw new UnrecoverableError(
        `Fresh replay fields are not supported yet: ${freshFields.join(', ')}`,
      );
    }
    const source = replay.sourceTrace;
    const replaySuffixes = source.name.match(/ \[replay(?: \d+)?\]/g) ?? [];
    const replayNumbers = replaySuffixes
      .map((suffix) => Number(suffix.match(/\d+/)?.[0] ?? 0))
      .filter((number) => number > 0);
    const baseName = source.name.replace(/(?: \[replay(?: \d+)?\])+$/, '');
    const replayNumber = replayNumbers.length > 0
      ? Math.max(...replayNumbers) + 1
      : (await this.prisma.replay.count({ where: { sourceTraceId: replay.sourceTraceId } })) + 1;
    const result = await this.prisma.trace.create({
      data: {
        projectId: source.projectId,
        name: `${baseName} [replay ${replayNumber}]`,
        environment: source.environment,
        status: source.status,
        input: source.input ?? Prisma.JsonNull,
        metadata: {
          replayId: replay.id,
          sourceTraceId: source.id,
          changedField: replay.changedField,
          fieldResolution: resolution,
        } as Prisma.InputJsonValue,
        totalDurationMs: source.totalDurationMs,
        totalCost: source.totalCost,
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });

    const idMap = new Map<string, string>();
    const orderedSpans = [...source.spans].sort((a, b) =>
      a.startedAt.getTime() - b.startedAt.getTime(),
    );
    for (const span of orderedSpans) {
      this.realtime.emitToProject(
        source.projectId,
        REALTIME_EVENTS.replayProgress,
        { replayId: replay.id, step: span.name, status: 'running' },
      );
      const model =
        resolution.model === 'changed' && span.type === SpanType.llm_call
          ? jsonText(replay.changedValue)
          : span.model;
      const input =
        resolution.prompt === 'changed'
          ? replay.changedValue
          : span.input ?? source.input;
      const argumentsValue =
        resolution.tool_arguments === 'changed'
          ? replay.changedValue
          : span.arguments;
      const resultValue =
        resolution.tool_response === 'changed'
          ? replay.changedValue
          : span.result;
      let output = span.output;
      if (span.type === SpanType.llm_call) {
        if (model === null) {
          throw new UnrecoverableError(`No model available for span ${span.name}`);
        }
        const response = await this.ai.replayLlmCall({
          model,
          prompt: jsonText(input),
          temperature:
            resolution.temperature === 'changed' &&
            typeof replay.changedValue === 'number'
              ? replay.changedValue
              : undefined,
        });
        output = response.output as Prisma.JsonValue;
      }
      const created = await this.prisma.span.create({
        data: {
          traceId: result.id,
          type: span.type,
          name: span.name,
          model,
          promptVersion: span.promptVersion,
          input: input ?? Prisma.JsonNull,
          output: output ?? Prisma.JsonNull,
          arguments: argumentsValue ?? Prisma.JsonNull,
          result: resultValue ?? Prisma.JsonNull,
          error: span.error ?? Prisma.JsonNull,
          tokenUsage: span.tokenUsage ?? Prisma.JsonNull,
          startedAt: span.startedAt,
          endedAt: span.endedAt,
        },
      });
      idMap.set(span.id, created.id);
      const spanPayload: SpanCreatedPayload = {
        traceId: result.id,
        span: created,
      };
      this.realtime.emitToProject(
        source.projectId,
        REALTIME_EVENTS.spanCreated,
        spanPayload,
      );
      this.realtime.emitToProject(
        source.projectId,
        REALTIME_EVENTS.replayProgress,
        { replayId: replay.id, step: span.name, status: 'completed' },
      );
    }
    for (const span of orderedSpans) {
      if (span.parentId !== null) {
        const newParentId = idMap.get(span.parentId);
        const newSpanId = idMap.get(span.id);
        if (newParentId !== undefined && newSpanId !== undefined) {
          await this.prisma.span.update({
            where: { id: newSpanId },
            data: { parentId: newParentId },
          });
        }
      }
    }
    return result.id;
  }
}
