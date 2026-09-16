export type EvaluatorType =
  | 'exact_match'
  | 'rule_based_rubric'
  | 'llm_judge';

export type EvaluationTargetType = 'trace' | 'replay';
