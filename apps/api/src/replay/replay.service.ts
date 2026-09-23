import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, ReplayStatus } from '@prisma/client';
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
