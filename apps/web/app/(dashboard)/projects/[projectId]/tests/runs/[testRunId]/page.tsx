'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useTestRun } from '../../../../../../../hooks/use-regression';

export default function TestRunPage({ params }: { params: Promise<{ projectId: string; testRunId: string }> }): React.JSX.Element {
  const { projectId, testRunId } = use(params);
  const run = useTestRun(testRunId);
  const [showSkipped, setShowSkipped] = useState(true);
  if (run.isPending) return <p className="state-panel trace-state">Loading test run...</p>;
  if (run.isError) return <p className="state-panel state-error trace-state" role="alert">Could not load test run: {run.error.message}</p>;
  if (run.data === undefined) return <p className="state-panel state-error trace-state">Test run was empty.</p>;
  const results = showSkipped ? run.data.results : run.data.results.filter((result) => result.passed !== null);
  return <div className="dashboard-page tests-page"><Link href={`/projects/${projectId}/tests`} className="back-link">Back to tests</Link><header className="page-intro"><div><p className="page-kicker mono">TEST RUN / {testRunId.slice(0, 8)}</p><h1>Suite results</h1><p>{run.data.model ?? run.data.promptVersion ?? 'Selected version'}</p></div><span className={`run-status run-status-${run.data.status}`}>{run.data.status}</span></header><section className="metric-grid"><div className="metric-card"><p className="mono">PASSED</p><strong>{run.data.passedCount}</strong></div><div className="metric-card"><p className="mono">FAILED</p><strong>{run.data.failedCount}</strong></div><div className="metric-card"><p className="mono">SKIPPED</p><strong>{run.data.skippedCount}</strong></div></section><section className="surface-panel"><div className="panel-heading"><h2>Per-test results</h2><label className="check-field"><input type="checkbox" checked={showSkipped} onChange={(event) => setShowSkipped(event.target.checked)} /> Show skipped</label></div><div className="regression-list">{results.map((result) => <div className="regression-row" key={result.id}><div><strong>{result.testName}</strong><p>{result.errorReason ?? `${result.score === null ? 'No score' : `${Math.round(result.score * 100)}% score`} · latency ${result.latencyDeltaMs === null ? '—' : `${result.latencyDeltaMs}ms`} · cost ${result.costDelta ?? '—'}`}</p></div><span className={`run-status run-status-${result.passed === true ? 'success' : result.passed === false ? 'failed' : 'running'}`}>{result.passed === true ? 'passed' : result.passed === false ? 'failed' : 'skipped'}</span></div>)}</div></section></div>;
}
