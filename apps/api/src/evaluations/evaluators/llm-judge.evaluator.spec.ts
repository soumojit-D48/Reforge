import { describe, expect, it, vi } from 'vitest';
import { LlmJudgeEvaluator } from './llm-judge.evaluator.js';

describe('LlmJudgeEvaluator', () => {
  it('maps the AI judge response into an evaluation result', async () => {
    const ai = { judge: vi.fn().mockResolvedValue({ score: 0.8, confidence: 0.9, reason: 'Meets the rubric.', model: 'openai/gpt-4o-mini', rawResponse: { raw: true } }) };
    const result = await new LlmJudgeEvaluator(ai as never).evaluate({ input: { question: 'Q' }, output: { answer: 'A' }, config: { model: 'openai/gpt-4o-mini', rubricVersion: 'v1', criteria: [{ name: 'correctness', description: 'Answer the question', weight: 1 }] } });
    expect(result.score).toBe(0.8);
    expect(result.confidence).toBe(0.9);
    expect(result.evaluatorVersion).toBe('llm-judge/openai/gpt-4o-mini');
    expect(result.rubricVersion).toBe('v1');
  });

  it('rejects an empty rubric', async () => {
    const ai = { judge: vi.fn() };
    await expect(new LlmJudgeEvaluator(ai as never).evaluate({ input: null, output: null, config: { criteria: [] } })).rejects.toThrow('criteria');
    expect(ai.judge).not.toHaveBeenCalled();
  });
});
