import { TraceStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListTracesDto } from './dto/list-traces.dto.js';
import { TracesService } from './traces.service.js';

function makeService() {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const prisma = {
    trace: {
      findMany,
      findUnique,
    },
  } as unknown as PrismaService;
  return { service: new TracesService(prisma), findMany, findUnique };
}

const trace = (id: string, startedAt: string, environment: string, status: TraceStatus) => ({
  id,
  name: id,
  environment,
  status,
  totalDurationMs: 100,
  totalCost: null,
  startedAt: new Date(startedAt),
  endedAt: new Date(startedAt),
  createdAt: new Date(startedAt),
  spans: [{ model: 'model-a' }],
  failureTags: [],
});

describe('TracesService', () => {
  it('returns the correct subset for combined filters', async () => {
    const { service, findMany } = makeService();
    findMany.mockResolvedValue([
      trace('failed-prod', '2026-09-16T10:00:00.000Z', 'production', 'failed'),
    ] as never);
    const query = Object.assign(new ListTracesDto(), {
      status: 'failed',
      environment: 'production',
      model: 'model-a',
      from: '2026-09-16T09:00:00.000Z',
      to: '2026-09-16T11:00:00.000Z',
      limit: 20,
    });

    const result = await service.list('project-1', query);
    expect(result.items.map((item) => item.id)).toEqual(['failed-prod']);
    const args = findMany.mock.calls[0]?.[0];
    expect(args?.where).toMatchObject({
      projectId: 'project-1',
      status: 'failed',
      environment: 'production',
    });
    expect(args?.where?.AND).toEqual([
      { spans: { some: { model: 'model-a' } } },
    ]);
  });

  it('caps the page size and returns a stable cursor', async () => {
    const { service, findMany } = makeService();
    const rows = Array.from({ length: 101 }, (_, index) =>
      trace(`trace-${index}`, `2026-09-16T${String(23 - Math.floor(index / 60)).padStart(2, '0')}:${String(59 - (index % 60)).padStart(2, '0')}:00.000Z`, 'production', 'success'),
    );
    findMany.mockResolvedValue(rows as never);
    const query = Object.assign(new ListTracesDto(), { limit: 100 });
    const result = await service.list('project-1', query);
    expect(result.items).toHaveLength(100);
    expect(result.limit).toBe(100);
    expect(result.nextCursor).not.toBeNull();
  });

  it('builds a nested span tree in chronological order', async () => {
    const { service, findUnique } = makeService();
    findUnique.mockResolvedValue({
      id: 'trace-1',
      projectId: 'project-1',
      externalId: null,
      name: 'nested',
      environment: 'test',
      status: 'failed',
      input: { question: 'q' },
      metadata: null,
      totalDurationMs: 500,
      totalCost: null,
      startedAt: new Date('2026-09-16T10:00:00.000Z'),
      endedAt: new Date('2026-09-16T10:00:00.500Z'),
      createdAt: new Date('2026-09-16T10:00:00.000Z'),
      failureTags: [],
      spans: [
        {
          id: 'child', parentId: 'root', type: 'tool_call', name: 'child', model: null,
          promptVersion: null, input: { a: 1 }, output: null, arguments: { x: 1 }, result: { ok: true },
          error: null, tokenUsage: { prompt: 1 }, startedAt: new Date('2026-09-16T10:00:00.200Z'), endedAt: new Date('2026-09-16T10:00:00.300Z'),
        },
        {
          id: 'root', parentId: null, type: 'llm_call', name: 'root', model: 'model-a',
          promptVersion: 'v1', input: null, output: { text: 'x' }, arguments: null, result: null,
          error: null, tokenUsage: null, startedAt: new Date('2026-09-16T10:00:00.100Z'), endedAt: new Date('2026-09-16T10:00:00.400Z'),
        },
      ],
    } as never);

    const result = await service.getById('trace-1');
    expect(result.spans.map((span) => span.id)).toEqual(['root']);
    expect(result.spans[0]?.children.map((span) => span.id)).toEqual(['child']);
    expect(result.spans[0]?.children[0]?.arguments).toEqual({ x: 1 });
    expect(result.spans[0]?.children[0]?.durationMs).toBe(100);
  });
});
