'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Evaluation, type EvaluationTargetType, type EvaluatorType, type Replay, type ReplayComparison, type ReplayField, type ReplayOutcome, type ReplayResolution } from '../lib/api-client';
import { getToken } from '../lib/auth';

export function useReplayMutation(traceId: string) {
  return useMutation<Replay, ApiError, {
    changedField: ReplayField;
    changedValue: unknown;
    fieldResolution: ReplayResolution;
  }>({
    mutationFn: (input) => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return api.createReplay(token, traceId, input);
    },
  });
}

export function useReplayStatus(replayId: string | null) {
  const token = getToken();
  return useQuery<Replay, ApiError>({
    queryKey: ['replay', replayId],
    queryFn: () => {
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return api.getReplay(token, replayId as string);
    },
    enabled: replayId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 1000;
    },
  });
}

export function useReplayComparison(replayId: string) {
  return useQuery<ReplayComparison, ApiError>({
    queryKey: ['replay-comparison', replayId],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return api.getReplayComparison(token, replayId);
    },
  });
}

export function useReplayOutcomeMutation(replayId: string) {
  const queryClient = useQueryClient();
  return useMutation<Replay, ApiError, ReplayOutcome>({
    mutationFn: (outcome) => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return api.updateReplayOutcome(token, replayId, outcome);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['replay-comparison', replayId] });
      void queryClient.invalidateQueries({ queryKey: ['replay', replayId] });
    },
  });
}

export function useEvaluationMutation() {
  return useMutation<Evaluation, ApiError, { targetType: EvaluationTargetType; targetId: string; evaluatorType: EvaluatorType; config: Record<string, unknown> }>({
    mutationFn: (input) => {
      const token = getToken();
      if (token === null) throw new ApiError(401, 'Not authenticated');
      return api.createEvaluation(token, input);
    },
  });
}

export function useEvaluationList(targetType: EvaluationTargetType, targetId: string) {
  return useQuery<Evaluation[], ApiError>({
    queryKey: ['evaluations', targetType, targetId],
    queryFn: () => {
      const token = getToken();
      if (token === null) throw new ApiError(401, 'Not authenticated');
      return api.listEvaluations(token, targetType, targetId);
    },
  });
}

export function useEvaluationStatus(evaluationId: string | null) {
  return useQuery<Evaluation, ApiError>({
    queryKey: ['evaluation', evaluationId],
    queryFn: () => {
      const token = getToken();
      if (token === null) throw new ApiError(401, 'Not authenticated');
      return api.getEvaluation(token, evaluationId as string);
    },
    enabled: evaluationId !== null,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    staleTime: 0,
    refetchInterval: (query) => query.state.data?.status === 'completed' || query.state.data?.status === 'failed' ? false : 1000,
  });
}

export function useEvaluationOverrideMutation(evaluationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<Evaluation, ApiError, { score: number; reason: string }>({
    mutationFn: (input) => {
      const token = getToken();
      if (token === null) throw new ApiError(401, 'Not authenticated');
      return api.overrideEvaluation(token, evaluationId as string, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['evaluation', evaluationId] });
    },
  });
}
