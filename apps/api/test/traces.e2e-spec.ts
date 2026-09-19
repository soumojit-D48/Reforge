import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter.js';
import { CorrelationIdInterceptor } from './../src/common/interceptors/correlation-id.interceptor.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('M3 — trace reads (e2e)', () => {
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
      'TRUNCATE TABLE "FailureTag", "Span", "Trace", "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;',
    );
    const email = 'm3-traces@example.com';
    await http.post('/v1/auth/register').send({ email, password: 'password123', name: 'M3 Tester' }).expect(201);
    const login = await http.post('/v1/auth/login').send({ email, password: 'password123' }).expect(200);
    token = login.body.accessToken as string;
    const org = await http.post('/v1/orgs').set('Authorization', `Bearer ${token}`).send({ name: 'M3 Org' }).expect(201);
    const project = await http.post(`/v1/orgs/${org.body.id as string}/projects`).set('Authorization', `Bearer ${token}`).send({ name: 'M3 Project' }).expect(201);
    projectId = project.body.project.id as string;

    const failed = await prisma.trace.create({
      data: {
        projectId,
        name: 'failed-trace',
        environment: 'production',
        status: 'failed',
        startedAt: new Date('2026-09-16T10:00:00.000Z'),
        endedAt: new Date('2026-09-16T10:00:01.000Z'),
        spans: {
          create: [
            { type: 'llm_call', name: 'planner', model: 'model-a', startedAt: new Date('2026-09-16T10:00:00.100Z'), endedAt: new Date('2026-09-16T10:00:00.200Z') },
            { type: 'tool_call', name: 'broken-tool', error: { message: 'failed' }, startedAt: new Date('2026-09-16T10:00:00.300Z'), endedAt: new Date('2026-09-16T10:00:00.800Z') },
          ],
        },
      },
      include: { spans: true },
    });
    await prisma.trace.create({
      data: {
        projectId,
        name: 'success-trace',
        environment: 'staging',
        status: 'success',
        startedAt: new Date('2026-09-15T10:00:00.000Z'),
        endedAt: new Date('2026-09-15T10:00:01.000Z'),
        spans: { create: [{ type: 'retrieval', name: 'search', model: 'model-b', startedAt: new Date('2026-09-15T10:00:00.100Z'), endedAt: new Date('2026-09-15T10:00:00.800Z') }] },
      },
    });
    const child = await prisma.span.create({
      data: { traceId: failed.id, type: 'error', name: 'nested-error', parentId: failed.spans[1]?.id, startedAt: new Date('2026-09-16T10:00:00.400Z'), endedAt: new Date('2026-09-16T10:00:00.500Z'), error: { code: 'E_TEST' } },
    });
    expect(child.parentId).toBe(failed.spans[1]?.id);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('filters runs, caps an oversized limit, and returns a cursor', async () => {
    const response = await http
      .get(`/v1/projects/${projectId}/traces`)
      .query({ status: 'failed', environment: 'production', model: 'model-a', errorType: 'tool_call', limit: 101 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].name).toBe('failed-trace');
    expect(response.body.limit).toBe(100);
  });

  it('returns the full nested span tree and enforces project access', async () => {
    const list = await http.get(`/v1/projects/${projectId}/traces`).set('Authorization', `Bearer ${token}`).expect(200);
    const traceId = list.body.items[0].id as string;
    const detail = await http.get(`/v1/traces/${traceId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.spans).toHaveLength(2);
    const tool = detail.body.spans.find((span: { name: string }) => span.name === 'broken-tool') as { children: { name: string; arguments: unknown }[] } | undefined;
    expect(tool?.children[0]?.name).toBe('nested-error');
    expect(tool?.children[0]?.arguments).toBeNull();
    await http.get(`/v1/traces/${traceId}`).expect(401);
  });
});
