import { ConflictException } from '@nestjs/common';
import { EvaluatorType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RegressionService } from './regression.service.js';

describe('RegressionService', () => {
  it('saves a source trace as a regression test and preserves its input', async () => {
    const created = {
      id: 'test-1', projectId: 'project-1', name: 'Order answer', input: { question: 'status?' },
      expectedBehavior: 'Answer correctly', evaluatorType: EvaluatorType.exact_match, evaluatorConfig: {},
      minScore: 1, promptVersion: null, model: 'model-a', environment: 'test', sourceTraceId: 'trace-1', createdAt: new Date('2026-09-24T00:00:00Z'),
    };
    const prisma = {
      trace: { findFirst: vi.fn().mockResolvedValue({ id: 'trace-1', input: { question: 'status?' }, environment: 'test' }) },
      regressionTest: { create: vi.fn().mockResolvedValue(created) },
    };
    const service = new RegressionService(prisma as never, {} as never);
    const result = await service.createTest('project-1', {
      name: 'Order answer', sourceTraceId: 'trace-1', expectedBehavior: 'Answer correctly',
      evaluatorType: EvaluatorType.exact_match, evaluatorConfig: {}, minScore: 1, model: 'model-a',
    });
    expect(result.id).toBe('test-1');
    expect(prisma.regressionTest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ input: { question: 'status?' }, sourceTraceId: 'trace-1' }) }));
  });

  it('rejects suite runs without a selected prompt or model', async () => {
    const prisma = { testSuite: { findUnique: vi.fn() } };
    const service = new RegressionService(prisma as never, {} as never);
    await expect(service.createRun('suite-1', undefined, undefined)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.testSuite.findUnique).not.toHaveBeenCalled();
  });
});
