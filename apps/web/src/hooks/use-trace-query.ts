'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  api,
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
