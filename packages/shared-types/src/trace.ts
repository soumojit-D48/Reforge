export type TraceStatus = 'running' | 'success' | 'failed';
export type SpanType =
  | 'retrieval'
  | 'llm_call'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export interface TraceSpanInput {
  id: string;
  parent_id: string | null;
  type: SpanType;
  name: string;
  model?: string;
  prompt_version?: string;
  input?: unknown;
  output?: unknown;
  token_usage?: { prompt?: number; completion?: number };
  error?: unknown;
  started_at: string;
  ended_at?: string;
}

export interface TraceInput {
  external_id?: string;
  name: string;
  environment?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  started_at: string;
  ended_at?: string;
  status: TraceStatus;
  spans: TraceSpanInput[];
}

export interface IngestTracePayload {
  project_key: string;
  trace: TraceInput;
}
