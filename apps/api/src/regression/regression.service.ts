import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, TestRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { TEST_RUN_JOB_OPTIONS, TEST_RUN_QUEUE, type TestRunJob } from './regression.constants.js';
import { CreateRegressionTestDto } from './dto/create-regression-test.dto.js';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto.js';
import { UpdateRegressionTestDto } from './dto/update-regression-test.dto.js';

export interface RegressionTestView {
  id: string;
  projectId: string;
  name: string;
  input: Prisma.JsonValue;
  expectedBehavior: string;
  evaluatorType: string;
  evaluatorConfig: Prisma.JsonValue | null;
  minScore: number;
  promptVersion: string | null;
  model: string | null;
  environment: string | null;
  sourceTraceId: string | null;
  createdAt: string;
}

export interface TestSuiteView {
  id: string;
  projectId: string;
  name: string;
  testCount: number;
  createdAt: string;
}

export interface TestRunResultView {
  id: string;
  regressionTestId: string;
  testName: string;
  replayId: string | null;
  evaluationId: string | null;
  passed: boolean | null;
  score: number | null;
  scoreDelta: number | null;
  latencyDeltaMs: number | null;
  costDelta: string | null;
  failureCategories: Prisma.JsonValue | null;
  errorReason: string | null;
}

export interface TestRunView {
  id: string;
  testSuiteId: string;
  promptVersion: string | null;
  model: string | null;
  status: TestRunStatus;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
  results: TestRunResultView[];
}

function jsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

function regressionView(test: {
  id: string; projectId: string; name: string; input: Prisma.JsonValue;
  expectedBehavior: string; evaluatorType: string; evaluatorConfig: Prisma.JsonValue | null;
  minScore: number; promptVersion: string | null; model: string | null;
  environment: string | null; sourceTraceId: string | null; createdAt: Date;
}): RegressionTestView {
  return { ...test, createdAt: test.createdAt.toISOString() };
}

@Injectable()
export class RegressionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TEST_RUN_QUEUE) private readonly testRunQueue: Queue<TestRunJob>,
  ) {}

  async createTest(projectId: string, dto: CreateRegressionTestDto): Promise<RegressionTestView> {
    const source = await this.prisma.trace.findFirst({ where: { id: dto.sourceTraceId, projectId } });
    if (source === null) throw new NotFoundException('Source trace not found in this project');
    const created = await this.prisma.regressionTest.create({
      data: {
        projectId,
        name: dto.name,
        input: source.input ?? Prisma.JsonNull,
        expectedBehavior: dto.expectedBehavior,
        evaluatorType: dto.evaluatorType,
        evaluatorConfig: jsonInput(dto.evaluatorConfig ?? {}),
        minScore: dto.minScore,
        promptVersion: dto.promptVersion,
        model: dto.model,
        environment: dto.environment ?? source.environment,
        sourceTraceId: source.id,
      },
    });
    return regressionView(created);
  }

  async listTests(projectId: string): Promise<RegressionTestView[]> {
    const tests = await this.prisma.regressionTest.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    return tests.map(regressionView);
  }

  async getTest(testId: string): Promise<RegressionTestView> {
    const test = await this.prisma.regressionTest.findUnique({ where: { id: testId } });
    if (test === null) throw new NotFoundException('Regression test not found');
    return regressionView(test);
  }

  async updateTest(testId: string, dto: UpdateRegressionTestDto): Promise<RegressionTestView> {
    const current = await this.prisma.regressionTest.findUnique({ where: { id: testId } });
    if (current === null) throw new NotFoundException('Regression test not found');
    let input: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
    let environment = dto.environment ?? current.environment;
    if (dto.sourceTraceId !== undefined) {
      const source = await this.prisma.trace.findFirst({ where: { id: dto.sourceTraceId, projectId: current.projectId } });
      if (source === null) throw new NotFoundException('Source trace not found in this project');
      input = jsonInput(source.input);
      environment = dto.environment ?? source.environment;
    }
    const updated = await this.prisma.regressionTest.update({
      where: { id: testId },
      data: {
        name: dto.name,
        sourceTraceId: dto.sourceTraceId,
        expectedBehavior: dto.expectedBehavior,
        evaluatorType: dto.evaluatorType,
        evaluatorConfig: dto.evaluatorConfig === undefined ? undefined : jsonInput(dto.evaluatorConfig),
        minScore: dto.minScore,
        promptVersion: dto.promptVersion,
        model: dto.model,
        environment,
        input,
      },
    });
    return regressionView(updated);
  }

  async deleteTest(testId: string): Promise<void> {
    const deleted = await this.prisma.regressionTest.deleteMany({ where: { id: testId } });
    if (deleted.count === 0) throw new NotFoundException('Regression test not found');
  }

  async createSuite(projectId: string, dto: CreateTestSuiteDto): Promise<TestSuiteView> {
    const suite = await this.prisma.testSuite.create({ data: { projectId, name: dto.name } });
    return { id: suite.id, projectId: suite.projectId, name: suite.name, testCount: 0, createdAt: suite.createdAt.toISOString() };
  }

  async listSuites(projectId: string): Promise<TestSuiteView[]> {
    const suites = await this.prisma.testSuite.findMany({ where: { projectId }, include: { _count: { select: { tests: true } } }, orderBy: { createdAt: 'desc' } });
    return suites.map((suite) => ({ id: suite.id, projectId: suite.projectId, name: suite.name, testCount: suite._count.tests, createdAt: suite.createdAt.toISOString() }));
  }

  async getSuite(suiteId: string): Promise<TestSuiteView & { tests: RegressionTestView[] }> {
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId }, include: { tests: { include: { regressionTest: true } }, _count: { select: { tests: true } } } });
    if (suite === null) throw new NotFoundException('Test suite not found');
    return { id: suite.id, projectId: suite.projectId, name: suite.name, testCount: suite._count.tests, createdAt: suite.createdAt.toISOString(), tests: suite.tests.map(({ regressionTest }) => regressionView(regressionTest)) };
  }

  async addTest(suiteId: string, testId: string): Promise<void> {
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId } });
    const test = await this.prisma.regressionTest.findUnique({ where: { id: testId } });
    if (suite === null || test === null || suite.projectId !== test.projectId) throw new NotFoundException('Suite or regression test not found in the same project');
    try {
      await this.prisma.testSuiteTest.create({ data: { testSuiteId: suiteId, regressionTestId: testId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Regression test is already in this suite');
      throw error;
    }
  }

  async removeTest(suiteId: string, testId: string): Promise<void> {
    const deleted = await this.prisma.testSuiteTest.deleteMany({ where: { testSuiteId: suiteId, regressionTestId: testId } });
    if (deleted.count === 0) throw new NotFoundException('Suite membership not found');
  }

  async createRun(suiteId: string, promptVersion: string | undefined, model: string | undefined): Promise<TestRunView> {
    if (promptVersion === undefined && model === undefined) throw new ConflictException('Choose a prompt version or model for the suite run');
    const suite = await this.prisma.testSuite.findUnique({ where: { id: suiteId }, include: { tests: true } });
    if (suite === null) throw new NotFoundException('Test suite not found');
    if (suite.tests.length === 0) throw new ConflictException('Cannot run an empty test suite');
    const run = await this.prisma.testRun.create({ data: { testSuiteId: suiteId, promptVersion, model } });
    try {
      await this.testRunQueue.add('run-test-suite', { testRunId: run.id }, { ...TEST_RUN_JOB_OPTIONS, jobId: run.id });
    } catch (error) {
      await this.prisma.testRun.update({ where: { id: run.id }, data: { status: TestRunStatus.failed, completedAt: new Date() } });
      throw error;
    }
    return this.getRun(run.id);
  }

  async getRun(runId: string): Promise<TestRunView> {
    const run = await this.prisma.testRun.findUnique({ where: { id: runId }, include: { results: { include: { regressionTest: { select: { name: true } } }, orderBy: { createdAt: 'asc' } } } });
    if (run === null) throw new NotFoundException('Test run not found');
    return {
      id: run.id, testSuiteId: run.testSuiteId, promptVersion: run.promptVersion, model: run.model,
      status: run.status, passedCount: run.passedCount, failedCount: run.failedCount, skippedCount: run.skippedCount,
      startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null,
      results: run.results.map((result) => ({ id: result.id, regressionTestId: result.regressionTestId, testName: result.regressionTest.name, replayId: result.replayId, evaluationId: result.evaluationId, passed: result.passed, score: result.score, scoreDelta: result.scoreDelta, latencyDeltaMs: result.latencyDeltaMs, costDelta: result.costDelta?.toString() ?? null, failureCategories: result.failureCategories, errorReason: result.errorReason })),
    };
  }
}
