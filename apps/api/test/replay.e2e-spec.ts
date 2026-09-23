import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { CorrelationIdInterceptor } from '../src/common/interceptors/correlation-id.interceptor.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const resolution = {
  prompt: 'reused',
  tool_arguments: 'reused',
  retrieval: 'mocked',
  tool_response: 'mocked',
  model: 'changed',
  temperature: 'reused',
};

describe('M5/M6 — replay and compare (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new CorrelationIdInterceptor());
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "Replay", "FailureTag", "Span", "Trace", "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;',
    );
    await http.post('/v1/auth/register').send({ email: 'm5-replay@example.com', password: 'password123', name: 'M5 Tester' }).expect(201);
    const login = await http.post('/v1/auth/login').send({ email: 'm5-replay@example.com', password: 'password123' }).expect(200);
    token = login.body.accessToken as string;
    const org = await http.post('/v1/orgs').set('Authorization', `Bearer ${token}`).send({ name: 'M5 Org' }).expect(201);
    const project = await http.post(`/v1/orgs/${org.body.id as string}/projects`).set('Authorization', `Bearer ${token}`).send({ name: 'M5 Project' }).expect(201);
    projectId = project.body.project.id as string;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  async function createTrace(name: string, withLlm = false): Promise<string> {
    const trace = await prisma.trace.create({
      data: {
        projectId,
        name,
        status: 'failed',
        totalDurationMs: 1000,
        totalCost: new Prisma.Decimal('0.10'),
        startedAt: new Date('2026-09-16T10:00:00.000Z'),
        endedAt: new Date('2026-09-16T10:00:01.000Z'),
        spans: {
          create: [
            {
              type: withLlm ? 'llm_call' : 'retrieval',
              name: withLlm ? 'planner' : 'search',
              model: 'openai/gpt-4o',
              input: { prompt: 'original' },
              startedAt: new Date('2026-09-16T10:00:00.100Z'),
              endedAt: new Date('2026-09-16T10:00:00.900Z'),
            },
          ],
        },
      },
    });
    return trace.id;
  }

  async function waitForReplay(replayId: string): Promise<{ status: string; resultTraceId: string | null }> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const response = await http.get(`/v1/replays/${replayId}`).set('Authorization', `Bearer ${token}`).expect(200);
      if (response.body.status === 'completed' || response.body.status === 'failed') {
        return response.body as { status: string; resultTraceId: string | null };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error('Replay did not settle in time');
  }

  it('rejects more than one changed field', async () => {
    const traceId = await createTrace('invalid-replay');
    await http
      .post(`/v1/traces/${traceId}/replay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ changedField: 'model', changedValue: 'openai/gpt-4o-mini', fieldResolution: { ...resolution, prompt: 'changed' } })
      .expect(400);
  });

  it('changes only model and persists a linked result trace', async () => {
    const traceId = await createTrace('model-replay', true);
    const created = await http
      .post(`/v1/traces/${traceId}/replay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ changedField: 'model', changedValue: 'openai/gpt-4o-mini', fieldResolution: resolution })
      .expect(202);
    const settled = await waitForReplay(created.body.id as string);
    expect(settled.status).toBe('completed');
    expect(settled.resultTraceId).not.toBe(traceId);
    const result = await prisma.trace.findUnique({ where: { id: settled.resultTraceId as string }, include: { spans: true } });
    expect(result?.spans[0]?.model).toBe('openai/gpt-4o-mini');
    expect((await prisma.trace.findUnique({ where: { id: traceId } }))?.name).toBe('model-replay');
  });

  it('blocks a concurrent replay on the same source trace', async () => {
    const traceId = await createTrace('locked-replay', true);
    const payload = { changedField: 'model', changedValue: 'openai/gpt-4o-mini', fieldResolution: resolution };
    await http.post(`/v1/traces/${traceId}/replay`).set('Authorization', `Bearer ${token}`).send(payload).expect(202);
    await http.post(`/v1/traces/${traceId}/replay`).set('Authorization', `Bearer ${token}`).send(payload).expect(409);
  });

  it('rejects unsupported fresh execution without creating a result trace', async () => {
    const traceId = await createTrace('failed-model-replay', true);
    const created = await http
      .post(`/v1/traces/${traceId}/replay`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        changedField: 'model',
        changedValue: 'openai/gpt-4o-mini',
        fieldResolution: { ...resolution, retrieval: 'fresh' },
      })
      .expect(202);
    const settled = await waitForReplay(created.body.id as string);
    expect(settled.status).toBe('failed');
    expect(settled.resultTraceId).toBeNull();
    const orphan = await prisma.trace.findFirst({
      where: { metadata: { path: ['replayId'], equals: created.body.id as string } },
    });
    expect(orphan).toBeNull();
  });

  it('compares a completed replay and persists its outcome', async () => {
    const sourceId = await createTrace('compare-source', true);
    const result = await prisma.trace.create({
      data: {
        projectId,
        name: 'compare-source [replay 1]',
        status: 'success',
        totalDurationMs: 700,
        totalCost: new Prisma.Decimal('0.02'),
        startedAt: new Date('2026-09-16T10:01:00.000Z'),
        endedAt: new Date('2026-09-16T10:01:00.700Z'),
        spans: {
          create: [{
            type: 'llm_call',
            name: 'planner',
            model: 'openai/gpt-4o-mini',
            output: { tool_selected: 'getOrderStatus' },
            tokenUsage: { prompt: 8, completion: 4 },
            startedAt: new Date('2026-09-16T10:01:00.100Z'),
            endedAt: new Date('2026-09-16T10:01:00.600Z'),
          }],
        },
      },
    });
    const replay = await prisma.replay.create({
      data: {
        sourceTraceId: sourceId,
        resultTraceId: result.id,
        changedField: 'model',
        changedValue: 'openai/gpt-4o-mini',
        fieldResolution: resolution,
        status: 'completed',
      },
    });

    const comparison = await http
      .get(`/v1/replays/${replay.id}/compare`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(comparison.body.original.id).toBe(sourceId);
    expect(comparison.body.result.id).toBe(result.id);
    expect(comparison.body.original.latencyMs).toBe(1000);
    expect(comparison.body.result.cost).toBe('0.02');
    expect(comparison.body.replay.fieldResolution.model).toBe('changed');

    await http
      .patch(`/v1/replays/${replay.id}/outcome`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcome: 'fixed' })
      .expect(200);
    const reloaded = await http
      .get(`/v1/replays/${replay.id}/compare`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(reloaded.body.replay.outcome).toBe('fixed');
  });

  it('does not compare a replay before it has a result trace', async () => {
    const sourceId = await createTrace('compare-pending', true);
    const replay = await prisma.replay.create({
      data: {
        sourceTraceId: sourceId,
        changedField: 'model',
        changedValue: 'openai/gpt-4o-mini',
        fieldResolution: resolution,
      },
    });
    await http
      .get(`/v1/replays/${replay.id}/compare`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
