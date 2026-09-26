import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const seedEmail = 'm3-seed@reforge.local';
const projectName = 'M3 Trace Investigation';

const traces = [
  {
    externalId: 'm3-success-001',
    name: 'order-status-success',
    environment: 'production',
    status: 'success',
    startedAt: '2026-09-16T09:30:00.000Z',
    endedAt: '2026-09-16T09:30:01.900Z',
    totalDurationMs: 1900,
    totalCost: '0.000348',
    input: { message: 'Where is my order?' },
    spans: [
      {
        id: 'retrieve',
        type: 'retrieval',
        name: 'retrieve-order-docs',
        input: { query: 'order status' },
        output: { documents: ['order-policy-v2'] },
        startedAt: '2026-09-16T09:30:00.100Z',
        endedAt: '2026-09-16T09:30:00.400Z',
      },
      {
        id: 'answer',
        type: 'llm_call',
        name: 'compose-answer',
        parentId: 'retrieve',
        model: 'openai/gpt-4o-mini',
        promptVersion: 'v2',
        input: { prompt: 'Answer using the retrieved order policy.' },
        output: { text: 'Your order is out for delivery.' },
        tokenUsage: { prompt: 320, completion: 24 },
        startedAt: '2026-09-16T09:30:00.500Z',
        endedAt: '2026-09-16T09:30:01.800Z',
      },
    ],
  },
  {
    externalId: 'm3-failed-001',
    name: 'order-status-tool-failure',
    environment: 'production',
    status: 'failed',
    startedAt: '2026-09-16T09:29:00.000Z',
    endedAt: '2026-09-16T09:29:08.400Z',
    totalDurationMs: 8400,
    totalCost: '0.001760',
    input: { message: 'Track order ORD-190' },
    spans: [
      {
        id: 'planner',
        type: 'llm_call',
        name: 'select-tool',
        model: 'openai/gpt-4o',
        promptVersion: 'v3',
        output: { toolSelected: 'getOrderStatus' },
        tokenUsage: { prompt: 512, completion: 48 },
        startedAt: '2026-09-16T09:29:00.200Z',
        endedAt: '2026-09-16T09:29:00.700Z',
      },
      {
        id: 'tool',
        type: 'tool_call',
        name: 'get-order-status',
        parentId: 'planner',
        arguments: { orderId: 'ORD-190' },
        startedAt: '2026-09-16T09:29:01.000Z',
        endedAt: '2026-09-16T09:29:08.000Z',
        error: { status: 404, message: 'Order not found' },
      },
      {
        id: 'tool-error',
        type: 'error',
        name: 'tool-error',
        parentId: 'tool',
        output: { message: 'External order API returned 404' },
        startedAt: '2026-09-16T09:29:08.100Z',
        endedAt: '2026-09-16T09:29:08.200Z',
        error: { type: 'external_api_failure', message: 'Order not found' },
      },
    ],
    failureTag: { category: 'external_api_failure', confidence: 0.94, source: 'ai' },
  },
  {
    externalId: 'm3-running-001',
    name: 'knowledge-search-running',
    environment: 'staging',
    status: 'running',
    startedAt: '2026-09-16T09:28:00.000Z',
    endedAt: null,
    totalDurationMs: null,
    totalCost: null,
    input: { message: 'Find the latest refund policy.' },
    spans: [
      {
        id: 'search',
        type: 'retrieval',
        name: 'search-knowledge-base',
        input: { query: 'refund policy' },
        startedAt: '2026-09-16T09:28:00.100Z',
        endedAt: null,
      },
    ],
  },
];

async function seed() {
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: seedEmail },
    update: { name: 'M3 Seed User', passwordHash },
    create: { email: seedEmail, name: 'M3 Seed User', passwordHash },
  });
  let organization = await prisma.organization.findFirst({
    where: { name: 'M3 Seed Organization' },
  });
  if (organization === null) {
    organization = await prisma.organization.create({
      data: { name: 'M3 Seed Organization' },
    });
  }
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: organization.id, userId: user.id },
    },
    update: { role: 'admin' },
    create: { organizationId: organization.id, userId: user.id, role: 'admin' },
  });
  let project = await prisma.project.findFirst({
    where: { organizationId: organization.id, name: projectName },
  });
  if (project === null) {
    project = await prisma.project.create({
      data: { organizationId: organization.id, name: projectName },
    });
  }

  for (const fixture of traces) {
    const trace = await prisma.trace.upsert({
      where: {
        projectId_externalId: { projectId: project.id, externalId: fixture.externalId },
      },
      update: {
        name: fixture.name,
        environment: fixture.environment,
        status: fixture.status,
        totalDurationMs: fixture.totalDurationMs,
        totalCost: fixture.totalCost,
        input: fixture.input,
        startedAt: new Date(fixture.startedAt),
        endedAt: fixture.endedAt === null ? null : new Date(fixture.endedAt),
      },
      create: {
        projectId: project.id,
        externalId: fixture.externalId,
        name: fixture.name,
        environment: fixture.environment,
        status: fixture.status,
        totalDurationMs: fixture.totalDurationMs,
        totalCost: fixture.totalCost,
        input: fixture.input,
        startedAt: new Date(fixture.startedAt),
        endedAt: fixture.endedAt === null ? undefined : new Date(fixture.endedAt),
      },
    });
    await prisma.span.deleteMany({ where: { traceId: trace.id } });
    const ids = new Map();
    for (const span of fixture.spans) {
      const created = await prisma.span.create({
        data: {
          traceId: trace.id,
          type: span.type,
          name: span.name,
          model: span.model,
          promptVersion: span.promptVersion,
          input: span.input,
          output: span.output,
          arguments: span.arguments,
          error: span.error,
          tokenUsage: span.tokenUsage,
          startedAt: new Date(span.startedAt),
          endedAt: span.endedAt === null ? undefined : new Date(span.endedAt),
        },
      });
      ids.set(span.id, created.id);
    }
    for (const span of fixture.spans) {
      if (span.parentId !== undefined) {
        await prisma.span.update({
          where: { id: ids.get(span.id) },
          data: { parentId: ids.get(span.parentId) },
        });
      }
    }
    await prisma.failureTag.deleteMany({ where: { traceId: trace.id } });
    if (fixture.failureTag !== undefined) {
      await prisma.failureTag.create({
        data: { traceId: trace.id, ...fixture.failureTag },
      });
    }
  }

  const reviewTrace = await prisma.trace.findUniqueOrThrow({
    where: {
      projectId_externalId: {
        projectId: project.id,
        externalId: 'm3-success-001',
      },
    },
  });
  const reviewEvaluation = await prisma.evaluation.upsert({
    where: { id: 'm9-seed-evaluation' },
    update: {
      traceId: reviewTrace.id,
      confidence: 0.2,
      score: 0.4,
      reason: 'Seeded low-confidence evaluation for human review.',
      status: 'completed',
      completedAt: new Date(),
    },
    create: {
      id: 'm9-seed-evaluation',
      targetType: 'trace',
      traceId: reviewTrace.id,
      evaluatorType: 'exact_match',
      evaluatorVersion: 'seed/v1',
      score: 0.4,
      confidence: 0.2,
      reason: 'Seeded low-confidence evaluation for human review.',
      status: 'completed',
      input: reviewTrace.input ?? undefined,
      output: { text: 'Your order is out for delivery.' },
      completedAt: new Date(),
    },
  });
  await prisma.annotation.upsert({
    where: { evaluationId: reviewEvaluation.id },
    update: {
      targetType: 'evaluation',
      reviewerId: null,
      verdict: 'needs_review',
      note: null,
    },
    create: {
      targetType: 'evaluation',
      evaluationId: reviewEvaluation.id,
      verdict: 'needs_review',
    },
  });
  console.log(`Seeded M3 traces in project ${project.id}`);
  console.log(`Seeded M9 review item ${reviewEvaluation.id}`);
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
