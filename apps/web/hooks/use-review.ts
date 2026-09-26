'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  api,
  type AnnotationVerdict,
  type ReviewDetail,
  type ReviewQueueItem,
} from '../lib/api-client';
import { getToken } from '../lib/auth';

function tokenOrThrow(): string {
  const token = getToken();

  if (token === null) {
    throw new ApiError(401, 'Not authenticated');
  }

  return token;
}

export function useReviewQueue(projectId: string) {
  return useQuery<ReviewQueueItem[], ApiError>({
    queryKey: ['review-queue', projectId],
    queryFn: () => api.listReviewQueue(tokenOrThrow(), projectId),
  });
}

export function useReviewDetail(
  projectId: string,
  annotationId: string | null,
) {
  return useQuery<ReviewDetail, ApiError>({
    queryKey: ['review-detail', projectId, annotationId],
    queryFn: () =>
      api.getReviewDetail(
        tokenOrThrow(),
        projectId,
        annotationId as string,
      ),
    enabled: annotationId !== null,
  });
}

export function useSubmitReview(projectId: string, annotationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    ReviewDetail,
    ApiError,
    { verdict: AnnotationVerdict; note?: string }
  >({
    mutationFn: (input) =>
      api.submitReview(
        tokenOrThrow(),
        projectId,
        annotationId as string,
        input,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['review-queue', projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['review-detail', projectId, annotationId],
      });
    },
  });
}
