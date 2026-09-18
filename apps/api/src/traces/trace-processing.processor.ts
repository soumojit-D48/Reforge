import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { FailureCategory, Prisma, TraceStatus } from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import { OpenRouterService } from '../ai/openrouter.service.js';
import {
  TRACE_PROCESSING_JOB_OPTIONS,
  TRACE_PROCESSING_QUEUE,
  type TraceProcessingJob,
} from '../ingestion/ingestion.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * USD per 1K tokens, by model. Deliberately a small static table of
 * estimates (not live pricing): unknown models cost 0 rather than a
 * guessed number — never invent money.
 */
const MODEL_PRICES_USD_PER_1K: Record<string, { prompt: number; completion: number }> = {
  'openai/gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'openai/gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'anthropic/claude-3.5-sonnet': { prompt: 0.003, completion: 0.015 },
};

@Processor(TRACE_PROCESSING_QUEUE)
export class TraceProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(TraceProcessingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenRouterService,
  ) {
    super();
  }

  async process(job: Job<TraceProcessingJob>): Promise<void> {
    const { traceId } = job.data;
    try {
      await this.processTrace(traceId);
    } catch (err) {
      // Terminal failure (retries exhausted, or unrecoverable by nature)
      // lands the trace in a visible state instead of dropping it silently
      // (ARCHITECTURE §5).
      const maxAttempts =
        typeof TRACE_PROCESSING_JOB_OPTIONS.attempts === 'number'
          ? TRACE_PROCESSING_JOB_OPTIONS.attempts
          : 1;
      if (
        err instanceof UnrecoverableError ||
        job.attemptsMade + 1 >= maxAttempts
      ) {
        this.logger.error(
          `trace-processing failed permanently for ${traceId}: ${(err as Error).message}`,
        );
        await this.prisma.trace.updateMany({
          where: { id: traceId },
          data: { status: 'processing_error' },
        });
      }
      throw err;
    }
  }

  private async processTrace(traceId: string): Promise<void> {
    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      include: { spans: true },
    });
    if (trace === null) {
      // Persist-before-enqueue is an ingestion invariant: a missing trace
      // can never appear on retry, so fail fast without burning attempts.
      throw new UnrecoverableError(`Trace ${traceId} not found for processing`);
    }

    // Test hook (e2e retry coverage): a magic metadata flag forces a
    // failure. Free-form metadata is otherwise untouched by processing.
    if (
      typeof trace.metadata === 'object' &&
      trace.metadata !== null &&
      (trace.metadata as Record<string, unknown>)['__testForceProcessingError'] === true
    ) {
      throw new Error('Forced processing failure (test hook)');
    }

    const totalDurationMs = this.computeDuration(trace);
    const totalCost = this.computeCost(trace);

    // Failure detection (conservative): error evidence forces `failed`;
    // anything else keeps the client-reported status untouched.
    const hasErrorEvidence = trace.spans.some(
      (s) => s.type === 'error' || (s.error !== null && s.error !== undefined),
    );
    const status: TraceStatus = hasErrorEvidence ? 'failed' : trace.status;

    // Tag before the final update: tests and readers treat a computed
    // duration as "processing done", so all worker output must be settled
    // by the time that row lands.
    if (status === 'failed') {
      await this.suggestFailureCategory(traceId, trace);
    }

    await this.prisma.trace.update({
      where: { id: traceId },
      data: { totalDurationMs, totalCost, status },
    });
  }

  private computeDuration(trace: {
    startedAt: Date;
    endedAt: Date | null;
    spans: { startedAt: Date; endedAt: Date | null }[];
  }): number | null {
    if (trace.endedAt !== null) {
      return trace.endedAt.getTime() - trace.startedAt.getTime();
    }
    let latest: number | null = null;
    for (const span of trace.spans) {
      if (span.endedAt !== null) {
        latest = Math.max(latest ?? 0, span.endedAt.getTime());
      }
    }
    return latest === null ? null : latest - trace.startedAt.getTime();
  }

  private computeCost(trace: {
    spans: { model: string | null; tokenUsage: unknown }[];
  }): Prisma.Decimal | null {
    let total = 0;
    let priced = false;
    for (const span of trace.spans) {
      const usage = span.tokenUsage as { prompt?: unknown; completion?: unknown } | null;
      const promptTokens = typeof usage?.prompt === 'number' ? usage.prompt : 0;
      const completionTokens =
        typeof usage?.completion === 'number' ? usage.completion : 0;
      if (promptTokens === 0 && completionTokens === 0) {
        continue;
      }
      const prices =
        span.model !== null ? MODEL_PRICES_USD_PER_1K[span.model] : undefined;
      if (prices === undefined) {
        continue;
      }
      priced = true;
      total +=
        (promptTokens / 1000) * prices.prompt +
        (completionTokens / 1000) * prices.completion;
    }
    return priced ? new Prisma.Decimal(total.toFixed(6)) : null;
  }

  private async suggestFailureCategory(
    traceId: string,
    trace: {
      name: string;
      status: TraceStatus;
      spans: {
        type: string;
        name: string;
        error: unknown;
        output: unknown;
      }[];
    },
  ): Promise<void> {
    const spanSummaries = trace.spans.map((s) => `${s.type} ${s.name}`);
    const errorExcerpts = trace.spans
      .map((s) => JSON.stringify(s.error ?? s.output ?? null))
      .filter((e) => e !== 'null')
      .slice(0, 10);
    try {
      const result = await this.ai.classifyFailure({
        traceName: trace.name,
        status: trace.status,
        spanSummaries,
        errorExcerpts,
      });
      if (result === null) {
        return;
      }
      await this.prisma.failureTag.create({
        data: {
          traceId,
          category: result.category as FailureCategory,
          confidence: result.confidence,
          source: 'ai',
        },
      });
    } catch (err) {
      // AI suggestion is advisory: a judge outage must never fail trace
      // processing itself — log loudly, continue without the tag.
      this.logger.warn(
        `AI failure classification failed for ${traceId}: ${(err as Error).message}`,
      );
    }
  }
}
