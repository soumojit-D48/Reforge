import type { JobsOptions } from 'bullmq';

export const TRACE_PROCESSING_QUEUE = 'trace-processing';

export interface TraceProcessingJob {
  traceId: string;
}

/** Per-queue retry policy (TECHSTACK §2.4): 3 attempts, exponential backoff. */
export const TRACE_PROCESSING_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
