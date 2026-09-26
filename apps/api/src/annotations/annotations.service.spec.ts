import { AnnotationTargetType, AnnotationVerdict } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AnnotationsService } from './annotations.service.js';

describe('AnnotationsService', () => {
  it('creates a review queue entry only below the threshold', async () => {
    const prisma = {
      annotation: {
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    };
    const service = new AnnotationsService(prisma as never);

    await service.enqueueEvaluationReview('evaluation-low', 0.59, 0.6);
    await service.enqueueEvaluationReview('evaluation-high', 0.6, 0.6);

    expect(prisma.annotation.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.annotation.upsert).toHaveBeenCalledWith({
      where: { evaluationId: 'evaluation-low' },
      create: {
        targetType: AnnotationTargetType.evaluation,
        evaluationId: 'evaluation-low',
        verdict: AnnotationVerdict.needs_review,
      },
      update: {},
    });
  });
});
