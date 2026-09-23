import type { Evaluator, EvaluatorContext, EvaluatorResult } from './evaluator.interface.js';

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

function atPath(value: unknown, path: string | undefined): unknown {
  if (path === undefined || path.trim() === '') return value;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

export class ExactMatchEvaluator implements Evaluator {
  async evaluate(context: EvaluatorContext): Promise<EvaluatorResult> {
    if (!('expected' in context.config)) {
      throw new Error('Exact-match evaluator requires config.expected');
    }
    const actual = atPath(context.output, typeof context.config.outputPath === 'string' ? context.config.outputPath : undefined);
    const expected = context.config.expected;
    const matched = stable(actual) === stable(expected);
    return {
      score: matched ? 1 : 0,
      confidence: 1,
      reason: matched ? 'Output exactly matches the expected value.' : 'Output does not match the expected value.',
      output: { actual, expected, matched },
      evaluatorVersion: 'exact-match/v1',
      rubricVersion: null,
    };
  }
}
