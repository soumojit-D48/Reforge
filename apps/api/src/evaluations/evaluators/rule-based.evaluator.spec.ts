import { describe, expect, it } from 'vitest';
import { RuleBasedEvaluator } from './rule-based.evaluator.js';

describe('RuleBasedEvaluator', () => {
  it('calculates a weighted score for matching rules', async () => {
    const result = await new RuleBasedEvaluator().evaluate({ input: null, output: { answer: 'approved', order: { id: 'ORD-1' } }, config: { rules: [{ path: 'answer', operator: 'equals', value: 'approved', weight: 2 }, { path: 'order.id', operator: 'exists', weight: 1 }] } });
    expect(result.score).toBe(1);
  });

  it('rejects malformed rules', async () => {
    await expect(new RuleBasedEvaluator().evaluate({ input: null, output: {}, config: { rules: [{ path: 'answer', operator: 'unknown' }] } })).rejects.toThrow('unsupported operator');
    await expect(new RuleBasedEvaluator().evaluate({ input: null, output: {}, config: {} })).rejects.toThrow('non-empty');
  });

  it('scores an empty output as a failed existence rule', async () => {
    const result = await new RuleBasedEvaluator().evaluate({ input: null, output: {}, config: { rules: [{ path: 'answer', operator: 'exists' }] } });
    expect(result.score).toBe(0);
  });
});
