import { FailureCategory, FailureSource } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { FailureTagsService } from './failure-tags.service.js';

function tag(overrides: Partial<{
  id: string;
  traceId: string;
  category: FailureCategory;
  confidence: number | null;
  source: FailureSource;
  note: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: 'tag-1',
    traceId: 'trace-1',
    category: FailureCategory.wrong_tool,
    confidence: null,
    source: FailureSource.human,
    note: null,
    createdAt: new Date('2026-09-16T10:00:00.000Z'),
    ...overrides,
  };
}

describe('FailureTagsService', () => {
  it('creates a human tag and normalizes a blank note', async () => {
    const prisma = {
      trace: { findUnique: vi.fn().mockResolvedValue({ id: 'trace-1' }) },
      failureTag: { create: vi.fn().mockResolvedValue(tag()) },
    };
    const service = new FailureTagsService(prisma as never);

    const result = await service.create('trace-1', {
      category: FailureCategory.wrong_tool,
      note: '   ',
    });

    expect(prisma.failureTag.create).toHaveBeenCalledWith({
      data: {
        traceId: 'trace-1',
        category: FailureCategory.wrong_tool,
        note: null,
        source: FailureSource.human,
      },
    });
    expect(result.source).toBe(FailureSource.human);
  });

  it('does not allow an AI tag to be edited', async () => {
    const prisma = {
      failureTag: {
        findFirst: vi.fn().mockResolvedValue(tag({ source: FailureSource.ai })),
        update: vi.fn(),
      },
    };
    const service = new FailureTagsService(prisma as never);

    await expect(
      service.update('trace-1', 'tag-1', { note: 'override' }),
    ).rejects.toThrow('AI failure tags cannot be edited');
    expect(prisma.failureTag.update).not.toHaveBeenCalled();
  });
});
