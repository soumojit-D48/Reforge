import { Prisma, ReplayFieldType, ReplayStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { buildComparison, ReplayService } from './replay.service.js';

describe('ReplayService', () => {
  it('rejects a second replay while the source trace lock is held', async () => {
    const prisma = {
      trace: { findUnique: vi.fn().mockResolvedValue({ id: 'trace-1' }) },
      replay: { create: vi.fn() },
    };
    const redis = { acquireReplayLock: vi.fn().mockResolvedValue(false) };
    const queue = { add: vi.fn() };
    const service = new ReplayService(prisma as never, redis as never, queue as never);

    await expect(
      service.create('trace-1', {
        changedField: ReplayFieldType.model,
        changedValue: 'openai/gpt-4o-mini',
        fieldResolution: {
          prompt: 'reused',
          tool_arguments: 'reused',
          retrieval: 'mocked',
          tool_response: 'mocked',
          model: 'changed',
          temperature: 'reused',
        },
      }),
    ).rejects.toThrow('A replay is already running');
    expect(prisma.replay.create).not.toHaveBeenCalled();
  });

  it('builds an original and result comparison with replay metrics', () => {
    const startedAt = new Date('2026-09-23T10:00:00.000Z');
    const endedAt = new Date('2026-09-23T10:00:02.000Z');
    const sourceSpan = {
      id: 'source-span',
      type: 'llm_call',
      name: 'select-tool',
      model: 'openai/gpt-4o',
      input: { prompt: 'Choose a tool' },
      output: { tool_selected: 'getOrderStatus' },
      arguments: null,
      result: null,
      error: null,
      tokenUsage: { prompt: 10, completion: 5 },
      startedAt,
      endedAt,
    };
    const resultSpan = { ...sourceSpan, id: 'result-span', model: 'openai/gpt-4o-mini', output: { tool_selected: 'getOrderStatus' } };
    const comparison = buildComparison({
      id: 'replay-1',
      sourceTraceId: 'source-trace',
      resultTraceId: 'result-trace',
      changedField: 'model',
      fieldResolution: { model: 'changed', prompt: 'reused' },
      status: ReplayStatus.completed,
      outcome: null,
      sourceTrace: {
        id: 'source-trace',
        name: 'source',
        status: 'failed',
        totalDurationMs: 2000,
        totalCost: new Prisma.Decimal('0.12'),
        spans: [sourceSpan],
      },
      resultTrace: {
        id: 'result-trace',
        name: 'result',
        status: 'success',
        totalDurationMs: 2000,
        totalCost: new Prisma.Decimal('0.02'),
        spans: [resultSpan],
      },
    });

    expect(comparison.original.selectedTool).toBe('getOrderStatus');
    expect(comparison.original.tokenUsage).toEqual([{ prompt: 10, completion: 5 }]);
    expect(comparison.original.cost).toBe('0.12');
    expect(comparison.original.latencyMs).toBe(2000);
    expect(comparison.result.spans[0]?.model).toBe('openai/gpt-4o-mini');
    expect(comparison.replay.fieldResolution).toEqual({ model: 'changed', prompt: 'reused' });
  });

  it('rejects comparison before a result trace exists', () => {
    expect(() => buildComparison({ resultTrace: null } as never)).toThrow(
      'Replay result is not available yet',
    );
  });
});
