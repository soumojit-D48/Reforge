'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type EvaluatorType, type RegressionTest, type TestRun, type TestSuite, type TestSuiteDetail } from '../lib/api-client';
import { getToken } from '../lib/auth';

function tokenOrThrow(): string {
  const token = getToken();
  if (token === null) throw new ApiError(401, 'Not authenticated');
  return token;
}

export function useRegressionTests(projectId: string) {
  return useQuery<RegressionTest[], ApiError>({ queryKey: ['regression-tests', projectId], queryFn: () => api.listRegressionTests(tokenOrThrow(), projectId) });
}

export function useTestSuites(projectId: string) {
  return useQuery<TestSuite[], ApiError>({ queryKey: ['test-suites', projectId], queryFn: () => api.listTestSuites(tokenOrThrow(), projectId) });
}

export function useTestSuite(suiteId: string) {
  return useQuery<TestSuiteDetail, ApiError>({ queryKey: ['test-suite', suiteId], queryFn: () => api.getTestSuite(tokenOrThrow(), suiteId) });
}

export function useCreateRegressionTest(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<RegressionTest, ApiError, { name: string; sourceTraceId: string; expectedBehavior: string; evaluatorType: EvaluatorType; evaluatorConfig: Record<string, unknown>; minScore: number; promptVersion?: string; model?: string; environment?: string }>({
    mutationFn: (input) => api.createRegressionTest(tokenOrThrow(), projectId, input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['regression-tests', projectId] }); },
  });
}

export function useCreateTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<TestSuite, ApiError, string>({
    mutationFn: (name) => api.createTestSuite(tokenOrThrow(), projectId, name),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] }); },
  });
}

export function useAddSuiteTest(suiteId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (testId) => api.addSuiteTest(tokenOrThrow(), suiteId, testId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['test-suite', suiteId] }); },
  });
}

export function useRunTestSuite(suiteId: string) {
  return useMutation<TestRun, ApiError, { promptVersion?: string; model?: string }>({ mutationFn: (input) => api.runTestSuite(tokenOrThrow(), suiteId, input) });
}

export function useTestRun(runId: string | null) {
  return useQuery<TestRun, ApiError>({
    queryKey: ['test-run', runId],
    queryFn: () => api.getTestRun(tokenOrThrow(), runId as string),
    enabled: runId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 1000;
    },
  });
}
