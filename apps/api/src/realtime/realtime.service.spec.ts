import type { Server } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import {
  REALTIME_EVENTS,
  type RealtimeEventName,
} from './realtime.constants.js';
import { RealtimeService } from './realtime.service.js';

describe('RealtimeService', () => {
  it('emits the documented event names and payloads to the project room', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const server = { to } as unknown as Server;
    const service = new RealtimeService();
    service.attachServer(server);

    const events: Array<[RealtimeEventName, unknown]> = [
      [REALTIME_EVENTS.spanCreated, { traceId: 'trace-1', span: { id: 'span-1' } }],
      [REALTIME_EVENTS.runStatusChanged, { traceId: 'trace-1', status: 'failed' }],
      [REALTIME_EVENTS.replayProgress, { replayId: 'replay-1', step: 'llm', status: 'running' }],
      [REALTIME_EVENTS.replayCompleted, { replayId: 'replay-1', resultTraceId: 'trace-2' }],
      [REALTIME_EVENTS.evaluationCompleted, { evaluationId: 'evaluation-1', score: 0.8, confidence: 0.7 }],
      [REALTIME_EVENTS.testRunProgress, { testRunId: 'run-1', testId: 'test-1', result: { passed: true } }],
      [REALTIME_EVENTS.testRunCompleted, { testRunId: 'run-1', passed: 1, failed: 0, skipped: 0 }],
      [REALTIME_EVENTS.presenceViewing, { traceId: 'trace-1', userId: 'user-2' }],
      [REALTIME_EVENTS.presenceLeft, { traceId: 'trace-1', userId: 'user-2' }],
    ];

    for (const [event, payload] of events) {
      service.emitToProject('project-1', event, payload);
    }

    expect(to).toHaveBeenCalledTimes(events.length);
    expect(to).toHaveBeenCalledWith('project:project-1');
    expect(emit).toHaveBeenNthCalledWith(1, REALTIME_EVENTS.spanCreated, events[0][1]);
    expect(emit).toHaveBeenNthCalledWith(8, REALTIME_EVENTS.presenceViewing, events[7][1]);
    expect(emit).toHaveBeenNthCalledWith(9, REALTIME_EVENTS.presenceLeft, events[8][1]);
  });
});
