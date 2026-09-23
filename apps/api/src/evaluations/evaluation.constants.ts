import type { JobsOptions } from 'bullmq';

export const EVALUATION_QUEUE = 'evaluation';

export interface EvaluationJob {
  evaluationId: string;
}

export const EVALUATION_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
