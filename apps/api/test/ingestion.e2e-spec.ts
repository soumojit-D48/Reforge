import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { json } from 'express';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { TRACE_PROCESSING_QUEUE } from './../src/ingestion/ingestion.constants.js';
import { OpenRouterService } from './../src/ai/openrouter.service.js';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter.js';
import { CorrelationIdInterceptor } from './../src/common/interceptors/correlation-id.interceptor.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Small, fast limits for the suite: the mechanism (limit → 413, count →
// 429) is identical to production values, only the thresholds differ.
// Per-test projects isolate Redis windows/keys between tests.
process.env['JSON_BODY_LIMIT'] = '4kb';
process.env['RATELIMIT_MAX_REQUESTS'] = '50';

function failedTracePayload(externalId: string): Record<string, unknown> {
  return {
    external_id: externalId,
    name: 'customer-support-run',
    environment: 'production',
    input: { message: 'Where is my order?' },
    started_at: '2026-09-16T09:31:02.000Z',
    ended_at: '2026-09-16T09:31:10.400Z',
    status: 'failed',
    spans: [
      {
        id: 'span_1',
        type: 'retrieval',
        name: 'retrieve_order_docs',
        started_at: '2026-09-16T09:31:02.100Z',
        ended_at: '2026-09-16T09:31:02.900Z',
      },
      {
        id: 'span_2',
        type: 'llm_call',
        name: 'select_tool',
        model: 'openai/gpt-4o-mini',
        token_usage: { prompt: 1000, completion: 500 },
        started_at: '2026-09-16T09:31:03.000Z',
        ended_at: '2026-09-16T09:31:03.400Z',
      },
      {
        id: 'span_3',
        parent_id: 'span_2',
        type: 'tool_call',
        name: 'getOrderStatus',
        error: { status: 404, message: 'Order not found' },
        started_at: '2026-09-16T09:31:03.500Z',
        ended_at: '2026-09-16T09:31:08.200Z',
      },
    ],
  };
}

describe('M2 — Trace Ingestion Pipeline (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  async function setupProject(email: string): Promise<{
    projectId: string;
    apiKey: string;
  }> {
    await http
      .post('/v1/auth/register')
      .send({ email, password: 'password123', name: 'Ingest User' })
      .expect(201);
    const login = await http
      .post('/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    const token = login.body.accessToken as string;
    const org = await http
      .post('/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${email} org` })
      .expect(201);
    const project = await http
      .post(`/v1/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${email} project` })
      .expect(201);
    return {
      projectId: project.body.project.id as string,
      apiKey: project.body.apiKey.key as string,
    };
  }

  async function waitForSettled(traceId: string): Promise<{
    status: string;
    totalDurationMs: number | null;
    totalCost: string | null;
    spanCount: number;
    tagCount: number;
    childLinked: boolean;
  }> {
    // Client-reported 'failed' is persisted at ingest, so status alone
    // cannot prove the worker ran: settle requires worker-written output
    // (duration, or the terminal processing_error mark).
    const started = Date.now();
    for (;;) {
      const trace = await prisma.trace.findUnique({
        where: { id: traceId },
        include: { spans: true, failureTags: true },
      });
      if (
        trace !== null &&
        trace.status !== 'running' &&
        (trace.totalDurationMs !== null || trace.status === 'processing_error')
      ) {
        const parents = new Set(trace.spans.map((s) => s.id));
        return {
          status: trace.status,
          totalDurationMs: trace.totalDurationMs,
          totalCost:
            trace.totalCost === null ? null : trace.totalCost.toString(),
          spanCount: trace.spans.length,
          tagCount: trace.failureTags.length,
          childLinked: trace.spans.some(
            (s) => s.parentId !== null && parents.has(s.parentId),
          ),
        };
      }
      if (Date.now() - started > 30000) {
        throw new Error(`Timed out waiting for trace ${traceId} to settle`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Deterministic AI verdicts: the skip-without-key path is unit
      // covered; e2e pins the tag-present path with a mock.
      .overrideProvider(OpenRouterService)
      .useValue({
        classifyFailure: async () => ({
          category: 'external_api_failure',
          confidence: 0.9,
          model: 'test-model',
          rawResponse: {},
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    const config = app.get(ConfigService);
    app.use(json({ limit: config.get<string>('JSON_BODY_LIMIT') ?? '1mb' }));
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
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "FailureTag", "Span", "Trace", "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;',
    );
    // Queues outlive the database across runs (Redis persists): stale jobs
    // from an interrupted run would otherwise process truncated trace ids
    // and clog the worker behind doomed retries.
    const queue = app.get<Queue>(getQueueToken(TRACE_PROCESSING_QUEUE));
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('versioned path works, unversioned path is rejected', async () => {
    const { apiKey } = await setupProject('version@example.com');
    await http
      .post('/ingest/trace')
      .set('x-api-key', apiKey)
      .send(failedTracePayload('ver-1'))
      .expect(404);
    await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(failedTracePayload('ver-1'))
      .expect(202);
  });

  it('rejects unauthenticated and malformed payloads', async () => {
    const { apiKey } = await setupProject('authn@example.com');
    await http
      .post('/v1/ingest/trace')
      .set('x-api-key', 'garbage')
      .send(failedTracePayload('authn-1'))
      .expect(401);
    await http.post('/v1/ingest/trace').send(failedTracePayload('authn-2')).expect(401);

    const badStatus = failedTracePayload('authn-3');
    badStatus['status'] = 'exploded';
    await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(badStatus)
      .expect(400);

    const noStarted = failedTracePayload('authn-4');
    delete noStarted['started_at'];
    await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(noStarted)
      .expect(400);
  });

  it('rejects oversized payloads with 413', async () => {
    const { apiKey } = await setupProject('big@example.com');
    const payload = failedTracePayload('big-1') as {
      input: Record<string, unknown>;
    };
    payload.input = { blob: 'x'.repeat(8 * 1024) };
    const res = await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(413);
    expect(res.body.correlationId).toBeDefined();
  });

  it('accepts a trace (202) and the worker persists + enriches it', async () => {
    const { apiKey } = await setupProject('happy@example.com');
    const res = await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(failedTracePayload('happy-1'))
      .expect(202);
    expect(res.body.duplicate).toBe(false);

    const settled = await waitForSettled(res.body.traceId as string);
    expect(settled.status).toBe('failed');
    // 8.4s wall clock from the fixture timestamps.
    expect(settled.totalDurationMs).toBe(8400);
    // 1k prompt @0.00015 + 0.5k completion @0.0006 gpt-4o-mini.
    expect(settled.totalCost).toBe('0.00045');
    expect(settled.spanCount).toBe(3);
    expect(settled.childLinked).toBe(true);
    // Mocked AI judge ran on the failed trace.
    expect(settled.tagCount).toBe(1);
    const tag = await prisma.failureTag.findFirst({
      where: { traceId: res.body.traceId as string },
    });
    expect(tag?.category).toBe('external_api_failure');
    expect(tag?.source).toBe('ai');
  }, 45000);

  it('leaves successful traces untagged and keeps their status', async () => {
    const { apiKey } = await setupProject('oktrace@example.com');
    const payload = failedTracePayload('ok-1');
    payload['status'] = 'success';
    const spans = payload['spans'] as Record<string, unknown>[];
    delete spans[2]!['error'];
    const res = await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(202);
    const settled = await waitForSettled(res.body.traceId as string);
    expect(settled.status).toBe('success');
    expect(settled.tagCount).toBe(0);
  }, 45000);

  it('dedupes a repeated external_id instead of duplicating', async () => {
    const { apiKey, projectId } = await setupProject('dupe@example.com');
    const first = await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(failedTracePayload('dupe-1'))
      .expect(202);
    const second = await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(failedTracePayload('dupe-1'))
      .expect(202);
    expect(second.body.traceId).toBe(first.body.traceId);
    expect(second.body.duplicate).toBe(true);

    await waitForSettled(first.body.traceId as string);
    const count = await prisma.trace.count({ where: { projectId } });
    expect(count).toBe(1);
  }, 45000);

  it('rate-limits per project with 429', async () => {
    const { apiKey } = await setupProject('limited@example.com');
    // Limit is 50/min via suite env; burn through it with unique ids.
    let limited = 0;
    for (let i = 0; i < 55; i += 1) {
      const res = await http
        .post('/v1/ingest/trace')
        .set('x-api-key', apiKey)
        .send(failedTracePayload(`limited-${i}`));
      if (res.status === 429) {
        limited += 1;
        expect(res.body.correlationId).toBeDefined();
        break;
      }
      expect(res.status).toBe(202);
    }
    expect(limited).toBe(1);
    // Drain this test's ~50 accepted jobs: the suite ends here for this
    // project, and orphaned jobs would otherwise process truncated trace
    // ids in the gap before the next obliterate (harmless but noisy).
    const rateQueue = app.get<Queue>(getQueueToken(TRACE_PROCESSING_QUEUE));
    await rateQueue.obliterate({ force: true });
  }, 90000);

  it('marks processing_error after repeated worker failure', async () => {
    const { apiKey } = await setupProject('poison@example.com');
    const payload = failedTracePayload('poison-1') as {
      metadata?: Record<string, unknown>;
    };
    payload.metadata = { __testForceProcessingError: true };
    const res = await http
      .post('/v1/ingest/trace')
      .set('x-api-key', apiKey)
      .send(payload)
      .expect(202);
    // 3 attempts with exponential backoff (~2s + ~4s) before terminal mark.
    const settled = await waitForSettled(res.body.traceId as string);
    expect(settled.status).toBe('processing_error');
  }, 90000);
});
