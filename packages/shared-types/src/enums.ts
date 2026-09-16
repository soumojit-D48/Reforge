export enum FailureCategory {
  bad_retrieval = 'bad_retrieval',
  wrong_tool = 'wrong_tool',
  invalid_tool_args = 'invalid_tool_args',
  external_api_failure = 'external_api_failure',
  timeout = 'timeout',
  hallucination = 'hallucination',
  prompt_injection = 'prompt_injection',
  evaluator_error = 'evaluator_error',
  unknown = 'unknown',
}
