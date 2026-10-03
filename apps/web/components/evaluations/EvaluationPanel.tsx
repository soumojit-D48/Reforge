'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { useEvaluationList, useEvaluationMutation, useEvaluationOverrideMutation, useEvaluationStatus } from '../../hooks/use-replay-mutation';
import type { EvaluationTargetType, EvaluatorType } from '../../lib/api-client';

const evaluatorOptions: { value: EvaluatorType; label: string }[] = [
  { value: 'exact_match', label: 'Exact match' },
  { value: 'rule_based_rubric', label: 'Rule-based rubric' },
  { value: 'llm_judge', label: 'LLM judge' },
];

function parseJson(value: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} must be a JSON object`);
  }
}

export function EvaluationPanel({ targetType, targetId }: { targetType: EvaluationTargetType; targetId: string }): React.JSX.Element {
  const [evaluatorType, setEvaluatorType] = useState<EvaluatorType>('exact_match');
  const [configText, setConfigText] = useState('{"expected": ""}');
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const evaluations = useEvaluationList(targetType, targetId);
  const createMutation = useEvaluationMutation();
  const evaluation = useEvaluationStatus(evaluationId);
  const overrideMutation = useEvaluationOverrideMutation(evaluationId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (evaluationId !== null || createMutation.isPending) return;
    const latest = evaluations.data?.[0];
    if (latest !== undefined) setEvaluationId(latest.id);
  }, [createMutation.isPending, evaluationId, evaluations.data]);

  useEffect(() => {
    if (evaluation.data === undefined) return;
    setEvaluatorType(evaluation.data.evaluatorType);
    setConfigText(JSON.stringify(evaluation.data.config ?? {}, null, 2));
  }, [evaluation.data]);

  const submit = (): void => {
    try {
      const config = parseJson(configText, 'Evaluator config');
      setConfigError(null);
      setEvaluationId(null);
      createMutation.mutate({ targetType, targetId, evaluatorType, config }, { onSuccess: (created) => {
        queryClient.setQueryData(['evaluation', created.id], created);
        setEvaluationId(created.id);
        void evaluations.refetch();
      } });
    } catch (error) {
      createMutation.reset();
      setConfigError(error instanceof Error ? error.message : 'Invalid evaluator config');
    }
  };

  return <section className="surface-panel evaluation-panel"><div className="panel-heading"><div><h2>Evaluate output</h2><p className="muted-copy">Score this {targetType} with a deterministic or AI-backed evaluator.</p></div></div><div className="evaluation-form-grid"><label className="form-field">Evaluator<select className="app-select" value={evaluatorType} onChange={(event) => setEvaluatorType(event.target.value as EvaluatorType)}>{evaluatorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="form-field">Configuration JSON<textarea className="app-input evaluation-config" value={configText} onChange={(event) => { setConfigText(event.target.value); setConfigError(null); }} rows={3} /></label></div>{configError === null ? null : <p className="form-error" role="alert">{configError}</p>}{createMutation.isError ? <p className="form-error" role="alert">Could not queue evaluation: {createMutation.error.message}</p> : null}{evaluation.isError ? <p className="form-error" role="alert">Could not load evaluation: {evaluation.error.message}</p> : null}{evaluation.data !== undefined ? <div className={`evaluation-result evaluation-result-${evaluation.data.status}`}><div><p className="mono">EVALUATION / {evaluation.data.status}</p>{evaluation.data.score === null ? <strong>Waiting for result</strong> : <strong>{Math.round(evaluation.data.score * 100)}% score</strong>}{evaluation.data.confidence === null ? null : <span>{Math.round(evaluation.data.confidence * 100)}% confidence</span>}{evaluation.data.reason === null ? null : <p>{evaluation.data.reason}</p>}</div>{evaluation.data.status === 'completed' ? <div className="evaluation-override"><input className="app-input" type="number" min="0" max="1" step="0.01" placeholder="Override score 0–1" value={overrideScore} onChange={(event) => setOverrideScore(event.target.value)} /><input className="app-input" placeholder="Override reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} /><Button type="button" variant="outline" disabled={overrideMutation.isPending || overrideScore === '' || overrideReason.trim() === ''} onClick={() => overrideMutation.mutate({ score: Number(overrideScore), reason: overrideReason })}>{overrideMutation.isPending ? 'Saving...' : 'Save override'}</Button>{evaluation.data.humanOverrideScore === null ? null : <small>Human override: {Math.round(evaluation.data.humanOverrideScore * 100)}% — {evaluation.data.humanOverrideReason}</small>}</div> : null}</div> : null}<Button type="button" className="signal-button" disabled={createMutation.isPending || evaluation.data?.status === 'pending' || configText.trim() === ''} onClick={submit}>{createMutation.isPending ? 'Queueing...' : 'Run evaluator'}</Button></section>;
}
