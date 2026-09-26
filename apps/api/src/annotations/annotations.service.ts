import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnnotationTargetType, AnnotationVerdict, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

interface ReviewTrace {
  id: string;
  input: Prisma.JsonValue | null;
  failureTags: Array<{
    category: string;
    confidence: number | null;
    source: string;
    note: string | null;
  }>;
  spans: Array<{
    id: string;
    type: string;
    name: string;
    input: Prisma.JsonValue | null;
    output: Prisma.JsonValue | null;
    arguments: Prisma.JsonValue | null;
    result: Prisma.JsonValue | null;
    error: Prisma.JsonValue | null;
  }>;
}

interface AnnotationSource {
  id: string;
  targetType: AnnotationTargetType;
  evaluationId: string | null;
  reviewerId: string | null;
  verdict: AnnotationVerdict;
  note: string | null;
  createdAt: Date;
  evaluation: {
    id: string;
    evaluatorType: string;
    evaluatorVersion: string | null;
    rubricVersion: string | null;
    input: Prisma.JsonValue | null;
    output: Prisma.JsonValue | null;
    score: number | null;
    confidence: number | null;
    reason: string | null;
    trace: ReviewTrace | null;
    replay: {
      resultTrace: ReviewTrace | null;
    } | null;
  } | null;
}

export interface ReviewQueueItem {
  id: string;
  evaluationId: string;
  verdict: AnnotationVerdict;
  createdAt: string;
  evaluatorType: string;
  score: number | null;
  confidence: number | null;
  reason: string | null;
  targetTraceId: string | null;
}

export interface ReviewDetail extends ReviewQueueItem {
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  evaluatorVersion: string | null;
  rubricVersion: string | null;
  suggestedCategories: ReviewTrace['failureTags'];
  spans: ReviewTrace['spans'];
  note: string | null;
  reviewerId: string | null;
}

function targetTrace(
  evaluation: AnnotationSource['evaluation'],
): ReviewTrace | null {
  if (evaluation === null) {
    return null;
  }

  return evaluation.trace ?? evaluation.replay?.resultTrace ?? null;
}

function queueView(annotation: AnnotationSource): ReviewQueueItem {
  const evaluation = annotation.evaluation;
  const trace = targetTrace(evaluation);

  return {
    id: annotation.id,
    evaluationId: annotation.evaluationId ?? '',
    verdict: annotation.verdict,
    createdAt: annotation.createdAt.toISOString(),
    evaluatorType: evaluation?.evaluatorType ?? 'unknown',
    score: evaluation?.score ?? null,
    confidence: evaluation?.confidence ?? null,
    reason: evaluation?.reason ?? null,
    targetTraceId: trace?.id ?? null,
  };
}

function detailView(annotation: AnnotationSource): ReviewDetail {
  const evaluation = annotation.evaluation;
  const trace = targetTrace(evaluation);
  const base = queueView(annotation);

  return {
    ...base,
    input: evaluation?.input ?? null,
    output: evaluation?.output ?? null,
    evaluatorVersion: evaluation?.evaluatorVersion ?? null,
    rubricVersion: evaluation?.rubricVersion ?? null,
    suggestedCategories: trace?.failureTags ?? [],
    spans: trace?.spans ?? [],
    note: annotation.note,
    reviewerId: annotation.reviewerId,
  };
}

@Injectable()
export class AnnotationsService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueEvaluationReview(
    evaluationId: string,
    confidence: number,
    threshold: number,
  ): Promise<void> {
    if (confidence >= threshold) {
      return;
    }

    await this.prisma.annotation.upsert({
      where: { evaluationId },
      create: {
        targetType: AnnotationTargetType.evaluation,
        evaluationId,
        verdict: AnnotationVerdict.needs_review,
      },
      update: {},
    });
  }

  async listQueue(projectId: string): Promise<ReviewQueueItem[]> {
    const annotations = await this.prisma.annotation.findMany({
      where: {
        targetType: AnnotationTargetType.evaluation,
        verdict: AnnotationVerdict.needs_review,
        reviewerId: null,
        evaluation: {
          OR: [
            { trace: { projectId } },
            { replay: { sourceTrace: { projectId } } },
          ],
        },
      },
      include: this.reviewInclude(),
      orderBy: { createdAt: 'asc' },
    });

    return annotations.map((annotation) => queueView(annotation));
  }

  async getDetail(projectId: string, annotationId: string): Promise<ReviewDetail> {
    const annotation = await this.prisma.annotation.findFirst({
      where: {
        id: annotationId,
        targetType: AnnotationTargetType.evaluation,
        evaluation: {
          OR: [
            { trace: { projectId } },
            { replay: { sourceTrace: { projectId } } },
          ],
        },
      },
      include: this.reviewInclude(),
    });

    if (annotation === null) {
      throw new NotFoundException('Review annotation not found');
    }

    return detailView(annotation);
  }

  async submit(
    projectId: string,
    annotationId: string,
    reviewerId: string,
    verdict: AnnotationVerdict,
    note?: string,
  ): Promise<ReviewDetail> {
    const annotation = await this.prisma.annotation.findFirst({
      where: {
        id: annotationId,
        targetType: AnnotationTargetType.evaluation,
        evaluation: {
          OR: [
            { trace: { projectId } },
            { replay: { sourceTrace: { projectId } } },
          ],
        },
      },
      select: {
        id: true,
        reviewerId: true,
        verdict: true,
      },
    });

    if (annotation === null) {
      throw new NotFoundException('Review annotation not found');
    }

    if (annotation.reviewerId !== null || annotation.verdict !== AnnotationVerdict.needs_review) {
      throw new ConflictException('This review has already been submitted');
    }

    await this.prisma.annotation.update({
      where: { id: annotationId },
      data: {
        reviewerId,
        verdict,
        note: note?.trim() || null,
      },
    });

    return this.getDetail(projectId, annotationId);
  }

  private reviewInclude() {
    return {
      evaluation: {
        select: {
          id: true,
          evaluatorType: true,
          evaluatorVersion: true,
          rubricVersion: true,
          input: true,
          output: true,
          score: true,
          confidence: true,
          reason: true,
          trace: {
            select: {
              id: true,
              input: true,
              failureTags: {
                select: {
                  category: true,
                  confidence: true,
                  source: true,
                  note: true,
                },
              },
              spans: {
                orderBy: { startedAt: 'asc' as const },
                select: {
                  id: true,
                  type: true,
                  name: true,
                  input: true,
                  output: true,
                  arguments: true,
                  result: true,
                  error: true,
                },
              },
            },
          },
          replay: {
            select: {
              resultTrace: {
                select: {
                  id: true,
                  input: true,
                  failureTags: {
                    select: {
                      category: true,
                      confidence: true,
                      source: true,
                      note: true,
                    },
                  },
                  spans: {
                    orderBy: { startedAt: 'asc' as const },
                    select: {
                      id: true,
                      type: true,
                      name: true,
                      input: true,
                      output: true,
                      arguments: true,
                      result: true,
                      error: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as const;
  }
}
