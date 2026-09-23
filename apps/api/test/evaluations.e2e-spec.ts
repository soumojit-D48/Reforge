import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('M7 — evaluation engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;
  let projectId: string;
  let traceId: string;

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [{ message: { content: '{"score":0.86,"confidence":0.91,"reason":"The answer satisfies the criteria."}' } }] }),
      text: () => Promise.resolve(''),
    } as Response));
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Evaluation", "Replay", "FailureTag", "Span", "Trace", "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;');
    await http.post('/v1/auth/register').send({ email: 'm7-evaluation@example.com', password: 'password123', name: 'M7 Tester' }).expect(201);
    const login = await http.post('/v1/auth/login').send({ email: 'm7-evaluation@example.com', password: 'password123' }).expect(200);
    token = login.body.accessToken as string;
    const org = await http.post('/v1/orgs').set('Authorization', `Bearer ${token}`).send({ name: 'M7 Org' }).expect(201);
    const project = await http.post(`/v1/orgs/${org.body.id as string}/projects`).set('Authorization', `Bearer ${token}`).send({ name: 'M7 Project' }).expect(201);
    projectId = project.body.project.id as string;
    const trace = await prisma.trace.create({
      data: {
        projectId,
        name: 'evaluation-sample',
        status: 'success',
        input: { question: 'What is 2 + 2?' },
        totalDurationMs: 500,
        totalCost: new Prisma.Decimal('0.01'),
        startedAt: new Date('2026-09-23T10:00:00.000Z'),
        endedAt: new Date('2026-09-23T10:00:00.500Z'),
        spans: { create: [{ type: 'llm_call', name: 'answer', output: { answer: '4' }, startedAt: new Date('2026-09-23T10:00:00.100Z'), endedAt: new Date('2026-09-23T10:00:00.400Z') }] },
      },
    });
    traceId = trace.id;
  }, 60000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  async function waitForEvaluation(id: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await http.get(`/v1/evaluations/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
      if (response.body.status === 'completed' || response.body.status === 'failed') return response.body as Record<string, unknown>;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Evaluation did not settle in time');
  }

  async function createEvaluation(evaluatorType: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const created = await http.post('/v1/evaluations').set('Authorization', `Bearer ${token}`).send({ targetType: 'trace', targetId: traceId, evaluatorType, config }).expect(202);
    return waitForEvaluation(created.body.id as string);
  }

  it('runs exact-match, rule-based, and LLM-judge evaluators', async () => {
    const exact = await createEvaluation('exact_match', { expected: { answer: '4' } });
    expect(exact.status).toBe('completed');
    expect(exact.score).toBe(1);
    expect(exact.evaluatorVersion).toBe('exact-match/v1');
    expect(exact.input).toEqual({ question: 'What is 2 + 2?' });
    expect(exact.output).toEqual({ actual: { answer: '4' }, expected: { answer: '4' }, matched: true });

    const rule = await createEvaluation('rule_based_rubric', { rubricVersion: 'rules-v1', rules: [{ path: 'answer', operator: 'equals', value: '4', weight: 2 }] });
    expect(rule.status).toBe('completed');
    expect(rule.score).toBe(1);
    expect(rule.rubricVersion).toBe('rules-v1');

    const judge = await createEvaluation('llm_judge', { model: 'openai/gpt-4o-mini', rubricVersion: 'judge-v1', criteria: [{ name: 'correctness', description: 'The answer is correct', weight: 1 }] });
    expect(judge.status).toBe('completed');
    expect(judge.score).toBe(0.86);
    expect(judge.confidence).toBe(0.91);
    expect(judge.reason).toContain('satisfies');
    expect(judge.evaluatorVersion).toBe('llm-judge/openai/gpt-4o-mini');
    expect(judge.rubricVersion).toBe('judge-v1');
  });

  it('stores human override separately from AI score', async () => {
    const created = await createEvaluation('exact_match', { expected: { answer: 'wrong' } });
    const evaluationId = created.id as string;
    await http.patch(`/v1/evaluations/${evaluationId}/override`).set('Authorization', `Bearer ${token}`).send({ score: 0.75, reason: 'Human reviewer considers the answer partially useful.' }).expect(200);
    const reloaded = await http.get(`/v1/evaluations/${evaluationId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(reloaded.body.score).toBe(0);
    expect(reloaded.body.confidence).toBe(1);
    expect(reloaded.body.humanOverrideScore).toBe(0.75);
    expect(reloaded.body.humanOverrideReason).toContain('partially useful');
  });

  it('lists evaluations by target for reload-safe frontend state', async () => {
    const created = await createEvaluation('exact_match', { expected: { answer: '4' } });
    const listed = await http
      .get(`/v1/evaluations?targetType=trace&targetId=${traceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((listed.body as { id: string }[]).some((evaluation) => evaluation.id === created.id)).toBe(true);
  });
});
