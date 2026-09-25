import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EvaluationTargetType, EvaluatorType, Prisma, TestRunStatus } from '@prisma/client';
import { UnrecoverableError, type Job } from 'bullmq';
import { EvaluationsService } from '../evaluations/evaluations.service.js';
import { ReplayService } from '../replay/replay.service.js';
import type { ReplayView } from '../replay/replay.service.js';
import type { ReplayResolution } from '../replay/replay-resolution.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TEST_RUN_QUEUE, type TestRunJob } from './regression.constants.js';

const POLL_INTERVAL_MS = 250;
const MAX_POLLS = 120;

type RegressionJobTest = {
  id: string;
  name: string;
  sourceTraceId: string | null;
  evaluatorType: EvaluatorType;
  evaluatorConfig: Prisma.JsonValue | null;
  minScore: number;
  model: string | null;
  promptVersion: string | null;
};

@Processor(TEST_RUN_QUEUE)
export class TestRunProcessor extends WorkerHost {
  private readonly logger = new Logger(TestRunProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly replays: ReplayService,
    private readonly evaluations: EvaluationsService,
  ) { super(); }

  async process(job: Job<TestRunJob>): Promise<void> {
    const run = await this.prisma.testRun.findUnique({
      where: { id: job.data.testRunId },
      include: { testSuite: { include: { tests: { include: { regressionTest: true } } } } },
    });
    if (run === null) throw new UnrecoverableError(`Test run ${job.data.testRunId} not found`);

    await this.prisma.testRun.update({ where: { id: run.id }, data: { status: TestRunStatus.running } });
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    try {
      for (const membership of run.testSuite.tests) {
        const test = membership.regressionTest;
        const result = await this.executeTest(run.id, test, run.promptVersion, run.model);
        if (result.passed === true) passedCount += 1;
        else if (result.passed === false) failedCount += 1;
        else skippedCount += 1;
      }
      await this.prisma.testRun.update({
        where: { id: run.id },
        data: { status: TestRunStatus.completed, passedCount, failedCount, skippedCount, completedAt: new Date() },
      });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('Test run failed');
      await this.prisma.testRun.update({ where: { id: run.id }, data: { status: TestRunStatus.failed, completedAt: new Date() } });
      this.logger.error(`test run failed permanently for ${run.id}: ${failure.message}`);
      throw error;
    }
  }

  private async executeTest(
    testRunId: string,
    test: RegressionJobTest,
    promptVersion: string | null,
    model: string | null,
  ): Promise<{ passed: boolean | null }> {
    if (test.sourceTraceId === null) return this.createSkippedResult(testRunId, test, 'Regression test has no source trace');
    const changedField: 'model' | 'prompt' = (model ?? test.model) !== null && (model ?? test.model) !== undefined ? 'model' : 'prompt';
    const changedValue = changedField === 'model'
      ? model ?? test.model ?? promptVersion ?? test.promptVersion
      : promptVersion ?? test.promptVersion;
    if (changedValue === null || changedValue === undefined) return this.createSkippedResult(testRunId, test, 'No prompt version or model was selected');

    try {
      const fieldResolution: ReplayResolution = {
        prompt: 'reused',
        tool_arguments: 'reused',
        retrieval: 'mocked',
        tool_response: 'mocked',
        model: 'reused',
        temperature: 'reused',
      };
      if (changedField === 'model') fieldResolution.model = 'changed';
      else fieldResolution.prompt = 'changed';
      const replay = await this.replays.create(test.sourceTraceId, {
        changedField,
        changedValue,
        fieldResolution,
      });
      const settledReplay = await this.waitForReplay(replay.id);
      if (settledReplay.status !== 'completed' || settledReplay.resultTraceId === null) {
        return this.createSkippedResult(testRunId, test, 'Replay did not complete successfully', settledReplay.id);
      }
      const evaluation = await this.evaluations.create({
        targetType: EvaluationTargetType.replay,
        targetId: replay.id,
        evaluatorType: test.evaluatorType,
        config: test.evaluatorConfig !== null && typeof test.evaluatorConfig === 'object' && !Array.isArray(test.evaluatorConfig)
          ? test.evaluatorConfig as Record<string, unknown>
          : {},
      });
      const settledEvaluation = await this.waitForEvaluation(evaluation.id);
      if (settledEvaluation.status !== 'completed' || settledEvaluation.score === null) {
        return this.createSkippedResult(testRunId, test, 'Evaluation did not complete successfully', replay.id, settledEvaluation.id);
      }
      const metrics = await this.calculateMetrics(testRunId, test.id, settledReplay.resultTraceId, settledEvaluation.score);
      await this.prisma.testRunResult.create({
        data: {
          testRunId,
          regressionTestId: test.id,
          replayId: replay.id,
          evaluationId: evaluation.id,
          passed: settledEvaluation.score >= test.minScore,
          score: settledEvaluation.score,
          scoreDelta: metrics.scoreDelta,
          latencyDeltaMs: metrics.latencyDeltaMs,
          costDelta: metrics.costDelta,
          failureCategories: metrics.failureCategories,
        },
      });
      return { passed: settledEvaluation.score >= test.minScore };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Regression test execution failed';
      return this.createSkippedResult(testRunId, test, reason);
    }
  }

  private async createSkippedResult(testRunId: string, test: RegressionJobTest, errorReason: string, replayId: string | null = null, evaluationId: string | null = null): Promise<{ passed: null }> {
    await this.prisma.testRunResult.create({ data: { testRunId, regressionTestId: test.id, replayId, evaluationId, passed: null, errorReason } });
    return { passed: null };
  }

  private async waitForReplay(replayId: string): Promise<ReplayView> {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      const replay = await this.replays.getById(replayId);
      if (replay.status === 'completed' || replay.status === 'failed') return replay;
      await this.sleep();
    }
    throw new Error('Replay did not settle in time');
  }

  private async waitForEvaluation(evaluationId: string) {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      const evaluation = await this.evaluations.getById(evaluationId);
      if (evaluation.status === 'completed' || evaluation.status === 'failed') return evaluation;
      await this.sleep();
    }
    throw new Error('Evaluation did not settle in time');
  }

  private async calculateMetrics(testRunId: string, regressionTestId: string, resultTraceId: string, score: number): Promise<{ scoreDelta: number | null; latencyDeltaMs: number | null; costDelta: string | null; failureCategories: Prisma.InputJsonValue }> {
    const result = await this.prisma.trace.findUnique({ where: { id: resultTraceId }, select: { totalDurationMs: true, totalCost: true, failureTags: { select: { category: true } } } });
    const test = await this.prisma.regressionTest.findUnique({ where: { id: regressionTestId }, select: { sourceTraceId: true } });
    const source = test?.sourceTraceId === null || test?.sourceTraceId === undefined ? null : await this.prisma.trace.findUnique({ where: { id: test.sourceTraceId }, select: { totalDurationMs: true, totalCost: true, failureTags: { select: { category: true } } } });
    const previous = await this.prisma.testRunResult.findFirst({ where: { regressionTestId, testRunId: { not: testRunId }, score: { not: null } }, orderBy: { createdAt: 'desc' }, select: { score: true } });
    const sourceCategories = new Set(source?.failureTags.map((tag) => tag.category) ?? []);
    const newCategories = result?.failureTags.map((tag) => tag.category).filter((category) => !sourceCategories.has(category)) ?? [];
    return {
      scoreDelta: previous?.score === null || previous === null ? null : score - previous.score,
      latencyDeltaMs: result?.totalDurationMs !== null && result?.totalDurationMs !== undefined && source?.totalDurationMs !== null && source?.totalDurationMs !== undefined ? result.totalDurationMs - source.totalDurationMs : null,
      costDelta: result?.totalCost !== null && result?.totalCost !== undefined && source?.totalCost !== null && source?.totalCost !== undefined ? (Number(result.totalCost) - Number(source.totalCost)).toFixed(6) : null,
      failureCategories: newCategories,
    };
  }

  private sleep(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS)); }
}
