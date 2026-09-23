import { describe, expect, it } from 'vitest';
import { ExactMatchEvaluator } from './exact-match.evaluator.js';

describe('ExactMatchEvaluator', () => {
  it('matches JSON values independent of object key order', async () => {
    const result = await new ExactMatchEvaluator().evaluate({ input: null, output: { b: 2, a: 1 }, config: { expected: { a: 1, b: 2 } } });
    expect(result.score).toBe(1);
  });

  it('rejects missing expected config', async () => {
    await expect(new ExactMatchEvaluator().evaluate({ input: null, output: 'actual', config: {} })).rejects.toThrow('config.expected');
  });

  it('handles an explicitly empty output', async () => {
    const result = await new ExactMatchEvaluator().evaluate({ input: null, output: null, config: { expected: null } });
    expect(result.score).toBe(1);
  });
});
