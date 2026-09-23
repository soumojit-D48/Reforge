import { EvaluationTargetType, EvaluatorType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EvaluationsService } from './evaluations.service.js';

describe('EvaluationsService', () => {
  it('persists a queued evaluation and enqueues only its id', async () => {
    const created = {
      id: 'evaluation-1',
      targetType: EvaluationTargetType.trace,
      traceId: 'trace-1',
      replayId: null,
      evaluatorType: EvaluatorType.exact_match,
      evaluatorVersion: null,
      rubricVersion: null,
      config: { expected: { answer: 'ok' } },
      input: { question: 'Q' },
      output: { answer: 'ok' },
      score: null,
      confidence: null,
      reason: null,
      status: 'pending',
      humanOverrideScore: null,
      humanOverrideReason: null,
      humanOverrideByUserId: null,
      createdAt: new Date('2026-09-23T10:00:00.000Z'),
      completedAt: null,
    };
    const prisma = {
      trace: { findUnique: vi.fn().mockResolvedValue({ input: { question: 'Q' }, spans: [{ output: { answer: 'ok' }, result: null }] }) },
      evaluation: { create: vi.fn().mockResolvedValue(created), update: vi.fn() },
    };
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const service = new EvaluationsService(prisma as never, queue as never);
    const result = await service.create({ targetType: EvaluationTargetType.trace, targetId: 'trace-1', evaluatorType: EvaluatorType.exact_match, config: { expected: { answer: 'ok' } } });
    expect(result.id).toBe('evaluation-1');
    expect(queue.add).toHaveBeenCalledWith('run-evaluation', { evaluationId: 'evaluation-1' }, expect.objectContaining({ attempts: 3 }));
  });
});
