import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('M8 — regression tests and suites (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;
  let projectId: string;
  let badTraceId: string;
  let goodTraceId: string;
  let regressionTestId: string;
  let suiteId: string;

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn());
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "TestRunResult", "TestRun", "TestSuiteTest", "TestSuite", "RegressionTest", "Evaluation", "Replay", "FailureTag", "Span", "Trace", "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;');
    await http.post('/v1/auth/register').send({ email: 'm8-regression@example.com', password: 'password123', name: 'M8 Tester' }).expect(201);
    const login = await http.post('/v1/auth/login').send({ email: 'm8-regression@example.com', password: 'password123' }).expect(200);
    token = login.body.accessToken as string;
    const org = await http.post('/v1/orgs').set('Authorization', `Bearer ${token}`).send({ name: 'M8 Org' }).expect(201);
    const project = await http.post(`/v1/orgs/${org.body.id as string}/projects`).set('Authorization', `Bearer ${token}`).send({ name: 'M8 Project' }).expect(201);
    projectId = project.body.project.id as string;
    badTraceId = await createTrace({ answer: 'wrong' });
    goodTraceId = await createTrace({ answer: 'correct' });
  }, 60000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  async function createTrace(output: Record<string, string>): Promise<string> {
    const trace = await prisma.trace.create({
      data: {
        projectId,
        name: 'regression-source',
        status: 'success',
        input: { question: 'What is the answer?' },
        totalDurationMs: 100,
        totalCost: new Prisma.Decimal('0.010000'),
        startedAt: new Date('2026-09-24T10:00:00.000Z'),
        endedAt: new Date('2026-09-24T10:00:00.100Z'),
        spans: { create: [{ type: 'tool_call', name: 'answer', output, startedAt: new Date('2026-09-24T10:00:00.010Z'), endedAt: new Date('2026-09-24T10:00:00.090Z') }] },
      },
    });
    return trace.id;
  }

  async function waitForRun(runId: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await http.get(`/v1/test-runs/${runId}`).set('Authorization', `Bearer ${token}`).expect(200);
      if (response.body.status === 'completed' || response.body.status === 'failed') return response.body as Record<string, unknown>;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Test run did not settle in time');
  }

  async function runSuite(): Promise<Record<string, unknown>> {
    const created = await http.post(`/v1/test-suites/${suiteId}/run`).set('Authorization', `Bearer ${token}`).send({ model: 'openai/gpt-4o-mini' }).expect(201);
    return waitForRun(created.body.id as string);
  }

  it('saves a failure, runs it, and fails against minScore', async () => {
    const created = await http.post(`/v1/projects/${projectId}/regression-tests`).set('Authorization', `Bearer ${token}`).send({ name: 'Correct answer guard', sourceTraceId: badTraceId, expectedBehavior: 'The answer is correct.', evaluatorType: 'exact_match', evaluatorConfig: { expected: { answer: 'correct' } }, minScore: 1 }).expect(201);
    regressionTestId = created.body.id as string;
    const suite = await http.post(`/v1/projects/${projectId}/test-suites`).set('Authorization', `Bearer ${token}`).send({ name: 'Release suite' }).expect(201);
    suiteId = suite.body.id as string;
    await http.post(`/v1/test-suites/${suiteId}/tests`).set('Authorization', `Bearer ${token}`).send({ regressionTestId }).expect(201);
    const run = await runSuite();
    expect(run.passedCount).toBe(0);
    expect(run.failedCount).toBe(1);
    expect((run.results as { score: number }[])[0].score).toBe(0);
  }, 60000);

  it('passes the same suite after the source output is fixed', async () => {
    await http.patch(`/v1/regression-tests/${regressionTestId}`).set('Authorization', `Bearer ${token}`).send({ sourceTraceId: goodTraceId }).expect(200);
    const run = await runSuite();
    expect(run.passedCount).toBe(1);
    expect(run.failedCount).toBe(0);
    expect((run.results as { score: number; scoreDelta: number }[])[0].score).toBe(1);
    expect((run.results as { scoreDelta: number }[])[0].scoreDelta).toBe(1);
  }, 60000);

  it('reports a regression after the original bad output is reintroduced', async () => {
    await http.patch(`/v1/regression-tests/${regressionTestId}`).set('Authorization', `Bearer ${token}`).send({ sourceTraceId: badTraceId }).expect(200);
    const run = await runSuite();
    expect(run.passedCount).toBe(0);
    expect(run.failedCount).toBe(1);
    expect((run.results as { scoreDelta: number }[])[0].scoreDelta).toBe(-1);
  }, 60000);
});
