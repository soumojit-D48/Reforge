import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EvaluatorType } from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import { EVALUATION_QUEUE, EVALUATION_JOB_OPTIONS, type EvaluationJob } from './evaluation.constants.js';
import { EvaluationsService } from './evaluations.service.js';
import { ExactMatchEvaluator } from './evaluators/exact-match.evaluator.js';
import { RuleBasedEvaluator } from './evaluators/rule-based.evaluator.js';
import { LlmJudgeEvaluator } from './evaluators/llm-judge.evaluator.js';
import { OpenRouterService } from '../ai/openrouter.service.js';

@Processor(EVALUATION_QUEUE)
export class EvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(EvaluationProcessor.name);

  constructor(
    private readonly evaluations: EvaluationsService,
    private readonly ai: OpenRouterService,
  ) { super(); }

  async process(job: Job<EvaluationJob>): Promise<void> {
    try {
      const context = await this.evaluations.getExecutionContext(job.data.evaluationId);
      const config = (context.evaluation.config ?? {}) as Record<string, unknown>;
      const evaluator = context.evaluation.evaluatorType === EvaluatorType.exact_match
        ? new ExactMatchEvaluator()
        : context.evaluation.evaluatorType === EvaluatorType.rule_based_rubric
          ? new RuleBasedEvaluator()
          : new LlmJudgeEvaluator(this.ai);
      const result = await evaluator.evaluate({ input: context.input, output: context.output, config });
      await this.evaluations.markCompleted(job.data.evaluationId, result);
    } catch (error) {
      const attempts = EVALUATION_JOB_OPTIONS.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts || error instanceof UnrecoverableError || error instanceof Error && /requires|unsupported|malformed|invalid/.test(error.message)) {
        const failure = error instanceof Error ? error : new Error('Evaluation failed');
        await this.evaluations.markFailed(job.data.evaluationId, failure);
        this.logger.error(`evaluation failed permanently for ${job.data.evaluationId}: ${failure.message}`);
        if (!(error instanceof UnrecoverableError) && error instanceof Error && /requires|unsupported|malformed|invalid/.test(error.message)) {
          throw new UnrecoverableError(failure.message);
        }
      }
      throw error;
    }
  }
}
