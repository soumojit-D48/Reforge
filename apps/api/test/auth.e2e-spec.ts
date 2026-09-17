import {
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import {
  ApiKeyGuard,
  type ApiKeyRequestContext,
} from './../src/common/guards/api-key.guard.js';
import { GlobalExceptionFilter } from './../src/common/filters/global-exception.filter.js';
import { CorrelationIdInterceptor } from './../src/common/interceptors/correlation-id.interceptor.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const ALLOWED_ORIGIN = 'http://localhost:3000';
const EVIL_ORIGIN = 'https://evil.example.com';

/**
 * Minimal probe route so `ApiKeyGuard` can be exercised end to end before
 * the real `/ingest/*` routes land in M2.
 */
@Controller('__probe')
class ProbeController {
  @UseGuards(ApiKeyGuard)
  @Get('ingest')
  probe(@Req() req: Request & { apiKey?: ApiKeyRequestContext }): unknown {
    return { projectId: req.apiKey?.projectId ?? null };
  }
}

describe('M1 — Auth, Organizations & Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let http: ReturnType<typeof request>;

  const register = (email: string, password = 'password123', name = 'Test User'): request.Test =>
    http.post('/auth/register').send({ email, password, name });

  async function registerAndLogin(email: string): Promise<string> {
    await register(email).expect(201);
    const res = await http
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
      providers: [ApiKeyGuard],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (origin === undefined || origin === ALLOWED_ORIGIN) {
          callback(null, true);
        } else {
          callback(new ForbiddenException(`Origin ${origin} not allowed`));
        }
      },
      credentials: true,
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
    jwt = app.get(JwtService);
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "ApiKey", "Project", "OrganizationMember", "Organization", "User" CASCADE;',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → login → create org → create project → generate API key', async () => {
    await register('alice@example.com').expect(201);
    await register('alice@example.com').expect(409);

    await http
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' })
      .expect(401);

    const login = await http
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' })
      .expect(200);
    const token = login.body.accessToken as string;
    expect(typeof token).toBe('string');

    const org = await http
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme' })
      .expect(201);
    expect(org.body.role).toBe('admin');

    const orgs = await http
      .get('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(orgs.body).toHaveLength(1);

    const project = await http
      .post(`/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Support Bot' })
      .expect(201);
    expect(project.body.apiKey.key as string).toMatch(/^pk_live_/);

    const key = await http
      .post(`/projects/${project.body.project.id as string}/api-keys`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(key.body.key as string).toMatch(/^pk_live_/);

    const keys = await http
      .get(`/projects/${project.body.project.id as string}/api-keys`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(keys.body).toHaveLength(2);
    for (const k of keys.body as { secretKeyHash?: string }[]) {
      expect(k.secretKeyHash).toBeUndefined();
    }

    const fullKey = key.body.key as string;
    await http
      .get('/__probe/ingest')
      .set('x-api-key', fullKey)
      .expect(200)
      .expect((res) => {
        if (res.body.projectId !== (project.body.project.id as string)) {
          throw new Error('probe did not resolve the key project');
        }
      });
  });

  it('CORS: allowlisted origin succeeds, non-allowlisted origin is rejected', async () => {
    const token = await registerAndLogin('cors@example.com');

    const allowed = await http
      .get('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ALLOWED_ORIGIN)
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);

    const denied = await http
      .get('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', EVIL_ORIGIN)
      .expect(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(denied.body.correlationId).toBeDefined();
  });

  it('a user from Org A gets 403 on Org B project routes', async () => {
    const tokenA = await registerAndLogin('orga@example.com');
    const tokenB = await registerAndLogin('orgb@example.com');

    const orgA = await http
      .post('/orgs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Org A' })
      .expect(201);
    const projectA = await http
      .post(`/orgs/${orgA.body.id as string}/projects`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Project A' })
      .expect(201);

    await http
      .get(`/orgs/${orgA.body.id as string}/projects`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    await http
      .post(`/orgs/${orgA.body.id as string}/projects`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hijack' })
      .expect(403);
    await http
      .get(`/projects/${projectA.body.project.id as string}/api-keys`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    const orgsB = await http
      .get('/orgs')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(orgsB.body).toHaveLength(0);
  });

  it('expired and invalid JWTs are rejected', async () => {
    const token = await registerAndLogin('jwt@example.com');

    await http.get('/orgs').expect(401);
    await http
      .get('/orgs')
      .set('Authorization', 'Bearer this-is-not-a-jwt')
      .expect(401);

    const decoded = jwt.decode(token) as { sub: string; email: string };
    // Sign with a bare JwtService (no default `expiresIn` sign option):
    // jsonwebtoken rejects a payload `exp` combined with any `expiresIn`
    // option, and the app's JwtService always carries that default.
    const config = app.get(ConfigService);
    const rawJwt = new JwtService({
      secret: config.getOrThrow<string>('JWT_SECRET'),
    });
    const expired = rawJwt.sign({
      sub: decoded.sub,
      email: decoded.email,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await http
      .get('/orgs')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('revoked API key is rejected by ApiKeyGuard', async () => {
    const token = await registerAndLogin('keys@example.com');
    const org = await http
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Keys Org' })
      .expect(201);
    const project = await http
      .post(`/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Keys Project' })
      .expect(201);
    const projectId = project.body.project.id as string;
    const key = await http
      .post(`/projects/${projectId}/api-keys`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const fullKey = key.body.key as string;
    const keyId = key.body.id as string;

    await http.get('/__probe/ingest').set('x-api-key', fullKey).expect(200);
    await http.get('/__probe/ingest').expect(401);
    await http.get('/__probe/ingest').set('x-api-key', 'garbage').expect(401);

    await http
      .delete(`/projects/${projectId}/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await http.get('/__probe/ingest').set('x-api-key', fullKey).expect(401);
  });

  it('rotating an API key revokes the old one and issues a working replacement', async () => {
    const token = await registerAndLogin('rotate@example.com');
    const org = await http
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rotate Org' })
      .expect(201);
    const project = await http
      .post(`/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rotate Project' })
      .expect(201);
    const projectId = project.body.project.id as string;
    const key = await http
      .post(`/projects/${projectId}/api-keys`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const oldKey = key.body.key as string;
    const keyId = key.body.id as string;

    const rotated = await http
      .post(`/projects/${projectId}/api-keys/${keyId}/rotate`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(rotated.body.revokedKeyId as string).toBe(keyId);
    const newKey = rotated.body.apiKey.key as string;
    expect(newKey).toMatch(/^pk_live_/);
    expect(newKey).not.toBe(oldKey);

    await http.get('/__probe/ingest').set('x-api-key', oldKey).expect(401);
    await http.get('/__probe/ingest').set('x-api-key', newKey).expect(200);

    await http
      .post(`/projects/${projectId}/api-keys/does-not-exist/rotate`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(404);
  });

  it('reviewer role cannot create projects or keys, admin can invite members', async () => {
    const adminToken = await registerAndLogin('adminrev@example.com');
    await registerAndLogin('reviewer@example.com');

    const org = await http
      .post('/orgs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Review Org' })
      .expect(201);

    await http
      .post(`/orgs/${org.body.id as string}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'reviewer@example.com', role: 'reviewer' })
      .expect(201);

    const reviewerLogin = await http
      .post('/auth/login')
      .send({ email: 'reviewer@example.com', password: 'password123' })
      .expect(200);
    const reviewerToken = reviewerLogin.body.accessToken as string;

    await http
      .post(`/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ name: 'Nope' })
      .expect(403);

    await http
      .get(`/orgs/${org.body.id as string}/projects`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);
  });
});
