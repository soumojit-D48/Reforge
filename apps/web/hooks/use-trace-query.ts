'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  api,
  type FailureCategory,
  type TraceDetail,
  type TraceListFilters,
  type TraceListResponse,
} from '../lib/api-client';
import { getToken } from '../lib/auth';

export function useTraceList(
  projectId: string,
  filters: TraceListFilters,
) {
  return useQuery<TraceListResponse, ApiError>({
    queryKey: ['traces', projectId, filters],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return api.listTraces(token, projectId, filters);
    },
  });
}

export function useTrace(traceId: string) {
  return useQuery<TraceDetail, ApiError>({
    queryKey: ['trace', traceId],
    queryFn: () => {
      const token = getToken();
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return api.getTrace(token, traceId);
    },
  });
}

export function useFailureTagMutation(traceId: string) {
  const queryClient = useQueryClient();
  const token = getToken();
  return useMutation({
    mutationFn: (input: {
      tagId?: string;
      category: FailureCategory;
      note: string;
    }) => {
      if (token === null) {
        throw new ApiError(401, 'Not authenticated');
      }
      return input.tagId === undefined
        ? api.createFailureTag(token, traceId, {
            category: input.category,
            note: input.note,
          })
        : api.updateFailureTag(token, traceId, input.tagId, {
            category: input.category,
            note: input.note,
          });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trace', traceId] });
    },
  });
}
