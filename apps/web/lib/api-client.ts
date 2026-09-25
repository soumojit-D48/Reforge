const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// All product routes are URI-versioned; bump in one place when v2 lands.
const API_VERSION_PREFIX = '/v1';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token !== null && token !== undefined && token !== '') {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}${API_VERSION_PREFIX}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data: unknown =
    text.length > 0
      ? (JSON.parse(text) as unknown)
      : null;
  if (!res.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

export interface Organization {
  id: string;
  name: string;
  role: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
}

export interface GeneratedKey {
  id: string;
  publicKey: string;
  key: string;
  status: string;
}

export interface ApiKeyView {
  id: string;
  publicKey: string;
  status: string;
  createdAt: string;
  revokedAt: string | null;
}

export type TraceStatus = 'running' | 'success' | 'failed' | 'processing_error';
export type FailureCategory =
  | 'bad_retrieval'
  | 'wrong_tool'
  | 'invalid_tool_args'
  | 'external_api_failure'
  | 'timeout'
  | 'hallucination'
  | 'prompt_injection'
  | 'evaluator_error'
  | 'unknown';

export type ReplayField =
  | 'prompt'
  | 'model'
  | 'tool_arguments'
  | 'retrieval_config'
  | 'temperature';
export type ReplayResolutionValue = 'changed' | 'reused' | 'mocked' | 'fresh';
export type ReplayOutcome = 'fixed' | 'partially_fixed' | 'not_fixed' | 'new_failure';
export type EvaluatorType = 'exact_match' | 'rule_based_rubric' | 'llm_judge';
export type EvaluationStatus = 'pending' | 'completed' | 'failed';
export type EvaluationTargetType = 'trace' | 'replay';
export interface Evaluation {
  id: string;
  targetType: EvaluationTargetType;
  traceId: string | null;
  replayId: string | null;
  evaluatorType: EvaluatorType;
  evaluatorVersion: string | null;
  rubricVersion: string | null;
  config: unknown;
  input: unknown;
  output: unknown;
  score: number | null;
  confidence: number | null;
  reason: string | null;
  status: EvaluationStatus;
  humanOverrideScore: number | null;
  humanOverrideReason: string | null;
  humanOverrideByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RegressionTest {
  id: string;
  projectId: string;
  name: string;
  input: unknown;
  expectedBehavior: string;
  evaluatorType: EvaluatorType;
  evaluatorConfig: unknown;
  minScore: number;
  promptVersion: string | null;
  model: string | null;
  environment: string | null;
  sourceTraceId: string | null;
  createdAt: string;
}

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  testCount: number;
  createdAt: string;
}

export interface TestSuiteDetail extends TestSuite {
  tests: RegressionTest[];
}

export interface TestRunResult {
  id: string;
  regressionTestId: string;
  testName: string;
  replayId: string | null;
  evaluationId: string | null;
  passed: boolean | null;
  score: number | null;
  scoreDelta: number | null;
  latencyDeltaMs: number | null;
  costDelta: string | null;
  failureCategories: unknown;
  errorReason: string | null;
}

export interface TestRun {
  id: string;
  testSuiteId: string;
  promptVersion: string | null;
  model: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
  results: TestRunResult[];
}
export type ReplayResolution = {
  prompt: ReplayResolutionValue;
  tool_arguments: ReplayResolutionValue;
  retrieval: ReplayResolutionValue;
  tool_response: ReplayResolutionValue;
  model: ReplayResolutionValue;
  temperature: ReplayResolutionValue;
};
export interface Replay {
  id: string;
  sourceTraceId: string;
  resultTraceId: string | null;
  changedField: ReplayField;
  changedValue: unknown;
  fieldResolution: ReplayResolution;
  status: 'queued' | 'running' | 'completed' | 'failed';
  outcome: ReplayOutcome | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ComparisonSpan {
  id: string;
  type: string;
  name: string;
  model: string | null;
  input: unknown;
  output: unknown;
  arguments: unknown;
  result: unknown;
  error: unknown;
  tokenUsage: unknown;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

export interface TraceComparison {
  id: string;
  name: string;
  status: TraceStatus;
  finalOutput: unknown;
  selectedTool: unknown;
  toolArguments: unknown;
  retrievalDocuments: unknown;
  tokenUsage: unknown[];
  cost: string | null;
  latencyMs: number | null;
  errors: unknown[];
  spans: ComparisonSpan[];
}

export interface ReplayComparison {
  replay: {
    id: string;
    sourceTraceId: string;
    resultTraceId: string;
    status: Replay['status'];
    outcome: ReplayOutcome | null;
    changedField: ReplayField;
    fieldResolution: ReplayResolution;
  };
  original: TraceComparison;
  result: TraceComparison;
}

export interface TraceListItem {
  id: string;
  name: string;
  environment: string | null;
  status: TraceStatus;
  totalDurationMs: number | null;
  totalCost: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  models: string[];
  failureCategories: string[];
  replayStatus: 'queued' | 'running' | 'completed' | 'failed' | null;
}

export interface TraceListResponse {
  items: TraceListItem[];
  nextCursor: string | null;
  limit: number;
}

export interface TraceSpan {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  model: string | null;
  promptVersion: string | null;
  input: unknown;
  output: unknown;
  arguments: unknown;
  result: unknown;
  error: unknown;
  tokenUsage: unknown;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  children: TraceSpan[];
}

export interface TraceDetail {
  id: string;
  projectId: string;
  externalId: string | null;
  name: string;
  environment: string | null;
  status: TraceStatus;
  input: unknown;
  metadata: unknown;
  totalDurationMs: number | null;
  totalCost: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  replay: {
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    changedField: ReplayField;
    fieldResolution: ReplayResolution;
  } | null;
  failureTags: {
    id: string;
    category: FailureCategory;
    confidence: number | null;
    source: string;
    note: string | null;
    createdAt: string;
  }[];
  spans: TraceSpan[];
}

export interface TraceListFilters {
  status?: TraceStatus;
  environment?: string;
  model?: string;
  from?: string;
  to?: string;
  errorType?: string;
  cursor?: string;
  limit?: number;
}

function queryString(filters: TraceListFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const encoded = params.toString();
  return encoded.length === 0 ? '' : `?${encoded}`;
}

export const api = {
  register: (input: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: input }),

  listOrgs: (token: string) =>
    request<Organization[]>('/orgs', { token }),

  createOrg: (token: string, name: string) =>
    request<Organization>('/orgs', { method: 'POST', body: { name }, token }),

  listProjects: (token: string, orgId: string) =>
    request<Project[]>(`/orgs/${orgId}/projects`, { token }),

  createProject: (token: string, orgId: string, name: string) =>
    request<{ project: Project; apiKey: GeneratedKey }>(
      `/orgs/${orgId}/projects`,
      { method: 'POST', body: { name }, token },
    ),

  listApiKeys: (token: string, projectId: string) =>
    request<ApiKeyView[]>(`/projects/${projectId}/api-keys`, { token }),

  generateApiKey: (token: string, projectId: string) =>
    request<GeneratedKey>(`/projects/${projectId}/api-keys`, {
      method: 'POST',
      token,
    }),

  revokeApiKey: (token: string, projectId: string, keyId: string) =>
    request<ApiKeyView>(`/projects/${projectId}/api-keys/${keyId}`, {
      method: 'DELETE',
      token,
    }),

  rotateApiKey: (token: string, projectId: string, keyId: string) =>
    request<{ apiKey: GeneratedKey; revokedKeyId: string }>(
      `/projects/${projectId}/api-keys/${keyId}/rotate`,
      { method: 'POST', token },
    ),

  listTraces: (token: string, projectId: string, filters: TraceListFilters = {}) =>
    request<TraceListResponse>(
      `/projects/${projectId}/traces${queryString(filters)}`,
      { token },
    ),

  getTrace: (token: string, traceId: string) =>
    request<TraceDetail>(`/traces/${traceId}`, { token }),

  createFailureTag: (
    token: string,
    traceId: string,
    input: { category: FailureCategory; note?: string },
  ) =>
    request<TraceDetail['failureTags'][number]>(
      `/traces/${traceId}/failure-tag`,
      { method: 'POST', body: input, token },
    ),

  updateFailureTag: (
    token: string,
    traceId: string,
    tagId: string,
    input: { category?: FailureCategory; note?: string | null },
  ) =>
    request<TraceDetail['failureTags'][number]>(
      `/traces/${traceId}/failure-tag/${tagId}`,
      { method: 'PATCH', body: input, token },
    ),

  createReplay: (
    token: string,
    traceId: string,
    input: {
      changedField: ReplayField;
      changedValue: unknown;
      fieldResolution: ReplayResolution;
    },
  ) =>
    request<Replay>(`/traces/${traceId}/replay`, {
      method: 'POST',
      body: input,
      token,
    }),

  getReplay: (token: string, replayId: string) =>
    request<Replay>(`/replays/${replayId}`, { token }),

  getReplayComparison: (token: string, replayId: string) =>
    request<ReplayComparison>(`/replays/${replayId}/compare`, { token }),

  updateReplayOutcome: (token: string, replayId: string, outcome: ReplayOutcome) =>
    request<Replay>(`/replays/${replayId}/outcome`, {
      method: 'PATCH',
      body: { outcome },
      token,
    }),

  createEvaluation: (
    token: string,
    input: { targetType: EvaluationTargetType; targetId: string; evaluatorType: EvaluatorType; config: Record<string, unknown> },
  ) => request<Evaluation>('/evaluations', { method: 'POST', body: input, token }),

  listEvaluations: (token: string, targetType: EvaluationTargetType, targetId: string) =>
    request<Evaluation[]>(`/evaluations?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, { token }),

  getEvaluation: (token: string, evaluationId: string) =>
    request<Evaluation>(`/evaluations/${evaluationId}`, { token }),

  overrideEvaluation: (token: string, evaluationId: string, input: { score: number; reason: string }) =>
    request<Evaluation>(`/evaluations/${evaluationId}/override`, { method: 'PATCH', body: input, token }),

  listRegressionTests: (token: string, projectId: string) =>
    request<RegressionTest[]>(`/projects/${projectId}/regression-tests`, { token }),

  createRegressionTest: (token: string, projectId: string, input: {
    name: string;
    sourceTraceId: string;
    expectedBehavior: string;
    evaluatorType: EvaluatorType;
    evaluatorConfig: Record<string, unknown>;
    minScore: number;
    promptVersion?: string;
    model?: string;
    environment?: string;
  }) => request<RegressionTest>(`/projects/${projectId}/regression-tests`, { method: 'POST', body: input, token }),

  deleteRegressionTest: (token: string, testId: string) =>
    request<void>(`/regression-tests/${testId}`, { method: 'DELETE', token }),

  updateRegressionTest: (token: string, testId: string, input: Partial<{
    name: string;
    sourceTraceId: string;
    expectedBehavior: string;
    evaluatorType: EvaluatorType;
    evaluatorConfig: Record<string, unknown>;
    minScore: number;
    promptVersion: string;
    model: string;
    environment: string;
  }>) => request<RegressionTest>(`/regression-tests/${testId}`, { method: 'PATCH', body: input, token }),

  listTestSuites: (token: string, projectId: string) =>
    request<TestSuite[]>(`/projects/${projectId}/test-suites`, { token }),

  createTestSuite: (token: string, projectId: string, name: string) =>
    request<TestSuite>(`/projects/${projectId}/test-suites`, { method: 'POST', body: { name }, token }),

  getTestSuite: (token: string, suiteId: string) =>
    request<TestSuiteDetail>(`/test-suites/${suiteId}`, { token }),

  addSuiteTest: (token: string, suiteId: string, regressionTestId: string) =>
    request<void>(`/test-suites/${suiteId}/tests`, { method: 'POST', body: { regressionTestId }, token }),

  removeSuiteTest: (token: string, suiteId: string, testId: string) =>
    request<void>(`/test-suites/${suiteId}/tests/${testId}`, { method: 'DELETE', token }),

  runTestSuite: (token: string, suiteId: string, input: { promptVersion?: string; model?: string }) =>
    request<TestRun>(`/test-suites/${suiteId}/run`, { method: 'POST', body: input, token }),

  getTestRun: (token: string, runId: string) =>
    request<TestRun>(`/test-runs/${runId}`, { token }),
};
