import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EvaluationStatus, EvaluationTargetType, EvaluatorType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { EVALUATION_JOB_OPTIONS, EVALUATION_QUEUE, type EvaluationJob } from './evaluation.constants.js';
import { CreateEvaluationDto } from './dto/create-evaluation.dto.js';
import type { EvaluatorResult } from './evaluators/evaluator.interface.js';

interface EvaluationViewSource {
  id: string;
  targetType: EvaluationTargetType;
  traceId: string | null;
  replayId: string | null;
  evaluatorType: EvaluatorType;
  evaluatorVersion: string | null;
  rubricVersion: string | null;
  config: Prisma.JsonValue | null;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  score: number | null;
  confidence: number | null;
  reason: string | null;
  status: EvaluationStatus;
  humanOverrideScore: number | null;
  humanOverrideReason: string | null;
  humanOverrideByUserId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface EvaluationView {
  id: string;
  targetType: EvaluationTargetType;
  traceId: string | null;
  replayId: string | null;
  evaluatorType: EvaluatorType;
  evaluatorVersion: string | null;
  rubricVersion: string | null;
  config: Prisma.JsonValue | null;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  score: number | null;
  confidence: number | null;
  reason: string | null;
  status: EvaluationStatus;
  humanOverrideScore: number | null;
  humanOverrideReason: string | null;
  humanOverrideByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
}

function toView(evaluation: EvaluationViewSource): EvaluationView {
  return {
    ...evaluation,
    createdAt: evaluation.createdAt.toISOString(),
    completedAt: evaluation.completedAt?.toISOString() ?? null,
  };
}

function jsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

function finalOutput(trace: { input: Prisma.JsonValue | null; spans: { output: Prisma.JsonValue | null; result: Prisma.JsonValue | null }[] }): { input: Prisma.JsonValue | null; output: Prisma.JsonValue | null } {
  const last = trace.spans.at(-1);
  return { input: trace.input, output: last?.output ?? last?.result ?? null };
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EVALUATION_QUEUE) private readonly queue: Queue<EvaluationJob>,
  ) {}

  async create(dto: CreateEvaluationDto): Promise<EvaluationView> {
    const target = await this.resolveTarget(dto.targetType, dto.targetId);
    const extracted = finalOutput(target.trace);
    const created = await this.prisma.evaluation.create({
      data: {
        targetType: dto.targetType,
        traceId: dto.targetType === EvaluationTargetType.trace ? dto.targetId : null,
        replayId: dto.targetType === EvaluationTargetType.replay ? dto.targetId : null,
        evaluatorType: dto.evaluatorType,
        config: jsonInput(dto.config ?? {}),
        input: jsonInput(extracted.input),
        output: jsonInput(extracted.output),
      },
    });
    try {
      await this.queue.add('run-evaluation', { evaluationId: created.id }, { ...EVALUATION_JOB_OPTIONS, jobId: created.id });
    } catch (error) {
      await this.prisma.evaluation.update({ where: { id: created.id }, data: { status: EvaluationStatus.failed, output: { error: 'Evaluation could not be queued' } } });
      throw error;
    }
    return toView(created);
  }

  async getById(evaluationId: string): Promise<EvaluationView> {
    const evaluation = await this.prisma.evaluation.findUnique({ where: { id: evaluationId } });
    if (evaluation === null) throw new NotFoundException('Evaluation not found');
    return toView(evaluation);
  }

  async list(targetType: EvaluationTargetType, targetId: string): Promise<EvaluationView[]> {
    const evaluations = await this.prisma.evaluation.findMany({
      where: targetType === EvaluationTargetType.trace ? { traceId: targetId } : { replayId: targetId },
      orderBy: { createdAt: 'desc' },
    });
    return evaluations.map(toView);
  }

  async override(evaluationId: string, userId: string, score: number, reason: string): Promise<EvaluationView> {
    const evaluation = await this.prisma.evaluation.findUnique({ where: { id: evaluationId } });
    if (evaluation === null) throw new NotFoundException('Evaluation not found');
    if (evaluation.status !== EvaluationStatus.completed) throw new ConflictException('Only completed evaluations can be overridden');
    const updated = await this.prisma.evaluation.update({ where: { id: evaluationId }, data: { humanOverrideScore: score, humanOverrideReason: reason, humanOverrideByUserId: userId } });
    return toView(updated);
  }

  async markCompleted(evaluationId: string, result: EvaluatorResult): Promise<void> {
    await this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: EvaluationStatus.completed,
        evaluatorVersion: result.evaluatorVersion,
        rubricVersion: result.rubricVersion,
        output: jsonInput(result.output),
        score: result.score,
        confidence: result.confidence,
        reason: result.reason,
        completedAt: new Date(),
      },
    });
  }

  async markFailed(evaluationId: string, error: Error): Promise<void> {
    await this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: EvaluationStatus.failed, output: { error: error.message }, completedAt: new Date() },
    });
  }

  async getExecutionContext(evaluationId: string): Promise<{ evaluation: EvaluationViewSource; input: unknown; output: unknown }> {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        trace: { include: { spans: { orderBy: { startedAt: 'asc' } } } },
        replay: { include: { resultTrace: { include: { spans: { orderBy: { startedAt: 'asc' } } } } } },
      },
    });
    if (evaluation === null) throw new NotFoundException('Evaluation not found');
    const trace = evaluation.targetType === EvaluationTargetType.trace ? evaluation.trace : evaluation.replay?.resultTrace;
    if (trace === null || trace === undefined) throw new ConflictException('Evaluation target is not available');
    const extracted = finalOutput(trace);
    return { evaluation, input: extracted.input, output: extracted.output };
  }

  private async resolveTarget(targetType: EvaluationTargetType, targetId: string): Promise<{ trace: { input: Prisma.JsonValue | null; spans: { output: Prisma.JsonValue | null; result: Prisma.JsonValue | null }[] } }> {
    if (targetType === EvaluationTargetType.trace) {
      const trace = await this.prisma.trace.findUnique({ where: { id: targetId }, include: { spans: { orderBy: { startedAt: 'asc' } } } });
      if (trace === null) throw new NotFoundException('Trace not found');
      return { trace };
    }
    const replay = await this.prisma.replay.findUnique({ where: { id: targetId }, include: { resultTrace: { include: { spans: { orderBy: { startedAt: 'asc' } } } } } });
    if (replay === null) throw new NotFoundException('Replay not found');
    if (replay.resultTrace === null || replay.status !== 'completed') throw new ConflictException('Replay result is not available');
    return { trace: replay.resultTrace };
  }
}
