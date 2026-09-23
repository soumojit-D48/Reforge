import type { JobsOptions } from 'bullmq';

export const REPLAY_EXECUTION_QUEUE = 'replay-execution';
export const REPLAY_LOCK_TTL_SECONDS = 15 * 60;

export interface ReplayExecutionJob {
  replayId: string;
}

export const REPLAY_EXECUTION_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
