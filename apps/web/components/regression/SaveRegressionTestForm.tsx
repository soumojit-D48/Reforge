'use client';

import { useState } from 'react';
import { useCreateRegressionTest } from '../../hooks/use-regression';
import type { EvaluatorType } from '../../lib/api-client';
import { Button } from '../ui/button';

export function SaveRegressionTestForm({ projectId, sourceTraceId }: { projectId: string; sourceTraceId: string }): React.JSX.Element {
  const mutation = useCreateRegressionTest(projectId);
  const [name, setName] = useState('Regression test');
  const [expectedBehavior, setExpectedBehavior] = useState('The agent returns the correct answer.');
  const [evaluatorType, setEvaluatorType] = useState<EvaluatorType>('exact_match');
  const [config, setConfig] = useState('{"expected": {}}');
  const [minScore, setMinScore] = useState('1');

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    let evaluatorConfig: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(config);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Configuration must be a JSON object');
      evaluatorConfig = parsed as Record<string, unknown>;
    } catch {
      mutation.reset();
      return;
    }
    mutation.mutate({ name, sourceTraceId, expectedBehavior, evaluatorType, evaluatorConfig, minScore: Number(minScore) });
  };

  return <form className="surface-panel regression-save-form" onSubmit={submit}>
    <div className="panel-heading"><div><h2>Save as regression test</h2><p className="muted-copy">Turn this output into a repeatable guardrail.</p></div></div>
    <label className="form-field">Test name<input className="app-input" value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label className="form-field">Expected behavior<textarea className="app-input" value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} rows={2} required /></label>
    <div className="replay-grid">
      <label className="form-field">Evaluator<select className="app-select" value={evaluatorType} onChange={(event) => setEvaluatorType(event.target.value as EvaluatorType)}><option value="exact_match">Exact match</option><option value="rule_based_rubric">Rule-based rubric</option><option value="llm_judge">LLM judge</option></select></label>
      <label className="form-field">Minimum score<input className="app-input" type="number" min="0" max="1" step="0.01" value={minScore} onChange={(event) => setMinScore(event.target.value)} required /></label>
    </div>
    <label className="form-field">Evaluator configuration JSON<textarea className="app-input json-input" value={config} onChange={(event) => setConfig(event.target.value)} rows={4} required /></label>
    {mutation.isError ? <p className="form-error" role="alert">Could not save test: {mutation.error.message}</p> : null}
    {mutation.isSuccess ? <p className="form-success">Regression test saved.</p> : null}
    <Button type="submit" className="signal-button" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save regression test'}</Button>
  </form>;
}
