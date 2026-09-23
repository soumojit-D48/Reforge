'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, type Replay, type ReplayComparison, type ReplayField, type ReplayOutcome, type ReplayResolution } from '../lib/api-client';
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
