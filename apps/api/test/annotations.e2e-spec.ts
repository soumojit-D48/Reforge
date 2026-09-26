import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('M9 — human review queue (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;
  let projectId: string;
  let traceId: string;

  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content:
                    '{"score":0.4,"confidence":0.4,"reason":"The answer needs human review."}',
                },
              },
            ],
          }),
        text: () => Promise.resolve(''),
      } as Response),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Annotation", "Evaluation", "Replay", "FailureTag", "Span", "Trace", "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;',
    );

    await http
      .post('/v1/auth/register')
      .send({
        email: 'm9-review@example.com',
        password: 'password123',
        name: 'M9 Reviewer',
      })
      .expect(201);

    const login = await http
      .post('/v1/auth/login')
      .send({ email: 'm9-review@example.com', password: 'password123' })
      .expect(200);
    token = login.body.accessToken as string;

    const org = await http
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'M9 Org' })
      .expect(201);
    const project = await http
      .post(`/v1/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'M9 Project' })
      .expect(201);
    projectId = project.body.project.id as string;

    const trace = await prisma.trace.create({
      data: {
        projectId,
        name: 'review-sample',
        status: 'success',
        input: { question: 'Can this answer be trusted?' },
        totalDurationMs: 200,
        totalCost: new Prisma.Decimal('0.02'),
        startedAt: new Date('2026-09-25T10:00:00.000Z'),
        endedAt: new Date('2026-09-25T10:00:00.200Z'),
        spans: {
          create: [
            {
              type: 'llm_call',
              name: 'answer',
              output: { text: 'The answer should be reviewed.' },
              startedAt: new Date('2026-09-25T10:00:00.100Z'),
              endedAt: new Date('2026-09-25T10:00:00.180Z'),
            },
          ],
        },
      },
    });
    traceId = trace.id;
  }, 60000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  async function waitForEvaluation(evaluationId: string) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await http
        .get(`/v1/evaluations/${evaluationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      if (
        response.body.status === 'completed' ||
        response.body.status === 'failed'
      ) {
        return response.body as Record<string, unknown>;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error('Evaluation did not settle in time');
  }

  it('queues low-confidence evaluations and excludes high-confidence evaluations', async () => {
    const low = await http
      .post('/v1/evaluations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'trace',
        targetId: traceId,
        evaluatorType: 'llm_judge',
        config: {
          model: 'openai/gpt-4o-mini',
          criteria: [
            {
              name: 'correctness',
              description: 'The answer is correct.',
              weight: 1,
            },
          ],
        },
      })
      .expect(202);
    const lowEvaluation = await waitForEvaluation(low.body.id as string);

    const high = await http
      .post('/v1/evaluations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        targetType: 'trace',
        targetId: traceId,
        evaluatorType: 'exact_match',
        config: {
          expected: { text: 'not the actual output' },
        },
      })
      .expect(202);
    await waitForEvaluation(high.body.id as string);

    const queue = await http
      .get(`/v1/projects/${projectId}/annotations/queue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(queue.body).toHaveLength(1);
    expect(queue.body[0].evaluationId).toBe(lowEvaluation.id);
    expect(queue.body[0].confidence).toBe(0.4);
  });

  it('persists a verdict and note linked to the evaluation', async () => {
    const queue = await http
      .get(`/v1/projects/${projectId}/annotations/queue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const annotationId = queue.body[0].id as string;
    const evaluationId = queue.body[0].evaluationId as string;

    const submitted = await http
      .patch(`/v1/projects/${projectId}/annotations/${annotationId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        verdict: 'incorrect',
        note: 'The evaluator score is not reliable for this response.',
      })
      .expect(200);

    expect(submitted.body.evaluationId).toBe(evaluationId);
    expect(submitted.body.verdict).toBe('incorrect');
    expect(submitted.body.note).toContain('not reliable');
    expect(submitted.body.reviewerId).toBeDefined();

    const queueAfter = await http
      .get(`/v1/projects/${projectId}/annotations/queue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(queueAfter.body).toHaveLength(0);
  });
});
