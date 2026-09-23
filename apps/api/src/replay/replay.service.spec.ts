import { ReplayFieldType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ReplayService } from './replay.service.js';

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
});
