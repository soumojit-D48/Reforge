export const PROJECT_ROOM_PREFIX = 'project:';

export const REALTIME_EVENTS = {
  spanCreated: 'span.created',
  runStatusChanged: 'run.status_changed',
  replayProgress: 'replay.progress',
  replayCompleted: 'replay.completed',
  evaluationCompleted: 'evaluation.completed',
  testRunProgress: 'test_run.progress',
  testRunCompleted: 'test_run.completed',
  presenceViewing: 'presence.viewing',
  presenceLeft: 'presence.left',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface SpanCreatedPayload {
  traceId: string;
  span: {
    id: string;
    type: string;
    name: string;
    input: unknown;
    output: unknown;
    arguments: unknown;
    result: unknown;
    error: unknown;
  };
}

export interface RunStatusChangedPayload {
  traceId: string;
  status: string;
}

export interface ReplayProgressPayload {
  replayId: string;
  step: string;
  status: string;
}

export interface ReplayCompletedPayload {
  replayId: string;
  resultTraceId: string;
}

export interface EvaluationCompletedPayload {
  evaluationId: string;
  score: number | null;
  confidence: number | null;
}

export interface TestRunProgressPayload {
  testRunId: string;
  testId: string;
  result: {
    passed: boolean | null;
    score?: number | null;
    errorReason?: string | null;
  };
}

export interface TestRunCompletedPayload {
  testRunId: string;
  passed: number;
  failed: number;
  skipped: number;
}

export interface PresenceViewingPayload {
  traceId: string;
  userId: string;
}

export type PresenceLeftPayload = PresenceViewingPayload;
