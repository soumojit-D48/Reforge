export const TEST_RUN_QUEUE = 'test-run';

export const TEST_RUN_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'exponential' as const, delay: 500 },
  removeOnComplete: 100,
  removeOnFail: 100,
};

export interface TestRunJob {
  testRunId: string;
}
