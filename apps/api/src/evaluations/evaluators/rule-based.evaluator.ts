import type { Evaluator, EvaluatorContext, EvaluatorResult } from './evaluator.interface.js';

type RuleOperator = 'equals' | 'contains' | 'exists';
interface Rule {
  path: string;
  operator: RuleOperator;
  value?: unknown;
  weight?: number;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

function atPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function parseRules(config: Record<string, unknown>): { rules: Rule[]; rubricVersion: string | null } {
  if (!Array.isArray(config.rules) || config.rules.length === 0) {
    throw new Error('Rule-based evaluator requires a non-empty config.rules array');
  }
  const rules = config.rules.map((raw, index): Rule => {
    if (raw === null || typeof raw !== 'object') throw new Error(`Rule ${index + 1} must be an object`);
    const rule = raw as Record<string, unknown>;
    if (typeof rule.path !== 'string' || rule.path.trim() === '') throw new Error(`Rule ${index + 1} requires path`);
    if (rule.operator !== 'equals' && rule.operator !== 'contains' && rule.operator !== 'exists') throw new Error(`Rule ${index + 1} has an unsupported operator`);
    if (rule.operator !== 'exists' && !('value' in rule)) throw new Error(`Rule ${index + 1} requires value`);
    const weight = rule.weight === undefined ? 1 : rule.weight;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) throw new Error(`Rule ${index + 1} weight must be positive`);
    return { path: rule.path, operator: rule.operator, value: rule.value, weight };
  });
  return { rules, rubricVersion: typeof config.rubricVersion === 'string' ? config.rubricVersion : null };
}

function matches(actual: unknown, rule: Rule): boolean {
  if (rule.operator === 'exists') return actual !== undefined && actual !== null;
  if (rule.operator === 'equals') return stable(actual) === stable(rule.value);
  if (typeof actual === 'string' && typeof rule.value === 'string') return actual.includes(rule.value);
  if (Array.isArray(actual)) return actual.some((item) => stable(item) === stable(rule.value));
  return false;
}

export class RuleBasedEvaluator implements Evaluator {
  async evaluate(context: EvaluatorContext): Promise<EvaluatorResult> {
    const { rules, rubricVersion } = parseRules(context.config);
    const results = rules.map((rule) => ({ ...rule, actual: atPath(context.output, rule.path), passed: matches(atPath(context.output, rule.path), rule) }));
    const totalWeight = rules.reduce((sum, rule) => sum + (rule.weight ?? 1), 0);
    const passedWeight = results.reduce((sum, result) => sum + (result.passed ? (result.weight ?? 1) : 0), 0);
    const score = totalWeight === 0 ? 0 : passedWeight / totalWeight;
    return {
      score,
      confidence: 1,
      reason: `${results.filter((result) => result.passed).length} of ${results.length} rubric rules passed.`,
      output: { results },
      evaluatorVersion: 'rule-based/v1',
      rubricVersion,
    };
  }
}
