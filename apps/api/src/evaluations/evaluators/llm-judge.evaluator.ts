import { OpenRouterService } from '../../ai/openrouter.service.js';
import type { Evaluator, EvaluatorContext, EvaluatorResult } from './evaluator.interface.js';

export class LlmJudgeEvaluator implements Evaluator {
  constructor(private readonly ai: OpenRouterService) {}

  async evaluate(context: EvaluatorContext): Promise<EvaluatorResult> {
    const criteria = context.config.criteria;
    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw new Error('LLM judge requires a non-empty config.criteria array');
    }
    const model = typeof context.config.model === 'string' && context.config.model.trim() !== ''
      ? context.config.model
      : undefined;
    const response = await this.ai.judge({
      model,
      input: context.input,
      output: context.output,
      criteria,
    });
    return {
      score: response.score,
      confidence: response.confidence,
      reason: response.reason,
      output: response.rawResponse,
      evaluatorVersion: `llm-judge/${response.model}`,
      rubricVersion: typeof context.config.rubricVersion === 'string' ? context.config.rubricVersion : null,
    };
  }
}
