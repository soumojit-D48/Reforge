export interface EvaluatorResult {
  score: number;
  confidence: number;
  reason: string;
  output: unknown;
  evaluatorVersion: string;
  rubricVersion: string | null;
}

export interface EvaluatorContext {
  input: unknown;
  output: unknown;
  config: Record<string, unknown>;
}

export interface Evaluator {
  evaluate(context: EvaluatorContext): Promise<EvaluatorResult>;
}
