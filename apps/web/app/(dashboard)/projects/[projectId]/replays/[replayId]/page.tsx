'use client';

import Link from 'next/link';
import { use } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CompareView } from '../../../../../../components/compare/CompareView';
import { EvaluationPanel } from '../../../../../../components/evaluations/EvaluationPanel';
import { SaveRegressionTestForm } from '../../../../../../components/regression/SaveRegressionTestForm';
import { useReplayComparison, useReplayOutcomeMutation } from '../../../../../../hooks/use-replay-mutation';
import type { ReplayOutcome } from '../../../../../../lib/api-client';

export default function ReplayComparePage({ params }: { params: Promise<{ projectId: string; replayId: string }> }): React.JSX.Element {
  const { projectId, replayId } = use(params);
  const comparison = useReplayComparison(replayId);
  const outcomeMutation = useReplayOutcomeMutation(replayId);

  if (comparison.isPending) return <p className="state-panel trace-state">Loading comparison...</p>;
  if (comparison.isError) return <p className="state-panel state-error trace-state" role="alert">Could not load comparison: {comparison.error.message}</p>;
  if (comparison.data === undefined) return <p className="state-panel state-error trace-state" role="alert">Comparison data was empty.</p>;

  return <div className="dashboard-page compare-page"><Link href={`/projects/${projectId}/traces/${comparison.data.replay.sourceTraceId}`} className="back-link"><ArrowLeft /> Back to source trace</Link><header className="page-intro"><div><p className="page-kicker mono">REPLAY COMPARE / {replayId.slice(0, 8)}</p><h1>Original vs replay</h1><p>Review the result and record whether the change helped.</p></div><span className={`run-status run-status-${comparison.data.replay.status}`}>{comparison.data.replay.status}</span></header>{outcomeMutation.isError ? <p className="form-error" role="alert">Could not save outcome: {outcomeMutation.error.message}</p> : null}<CompareView comparison={comparison.data} onOutcome={(outcome: ReplayOutcome) => outcomeMutation.mutate(outcome)} /><EvaluationPanel targetType="replay" targetId={replayId} /><SaveRegressionTestForm projectId={projectId} sourceTraceId={comparison.data.result.id} /></div>;
}
