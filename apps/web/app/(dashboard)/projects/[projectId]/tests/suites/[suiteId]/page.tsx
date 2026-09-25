'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useAddSuiteTest, useRegressionTests, useRunTestSuite, useTestSuite, useTestRun } from '../../../../../../../hooks/use-regression';
import { Button } from '../../../../../../../components/ui/button';

export default function SuitePage({ params }: { params: Promise<{ projectId: string; suiteId: string }> }): React.JSX.Element {
  const { projectId, suiteId } = use(params);
  const suite = useTestSuite(suiteId);
  const tests = useRegressionTests(projectId);
  const addTest = useAddSuiteTest(suiteId);
  const run = useRunTestSuite(suiteId);
  const [selectedTest, setSelectedTest] = useState('');
  const [model, setModel] = useState('openai/gpt-4o-mini');
  const [runId, setRunId] = useState<string | null>(null);
  const testRun = useTestRun(runId);

  if (suite.isPending || tests.isPending) return <p className="state-panel trace-state">Loading suite...</p>;
  if (suite.isError || tests.isError) return <p className="state-panel state-error trace-state" role="alert">Could not load suite.</p>;

  const memberIds = new Set(suite.data.tests.map((test) => test.id));
  const available = tests.data.filter((test) => !memberIds.has(test.id));
  return <div className="dashboard-page tests-page"><Link href={`/projects/${projectId}/tests`} className="back-link">Back to tests</Link><header className="page-intro"><div><p className="page-kicker mono">TEST SUITE</p><h1>{suite.data.name}</h1><p>{suite.data.testCount} regression tests</p></div></header>
    <section className="surface-panel"><div className="panel-heading"><h2>Members</h2><span className="mono">{suite.data.tests.length}</span></div>{suite.data.tests.length === 0 ? <p className="muted-copy">Add a regression test to start.</p> : <div className="regression-list">{suite.data.tests.map((test) => <div className="regression-row" key={test.id}><strong>{test.name}</strong><span className="mono">MIN {Math.round(test.minScore * 100)}%</span></div>)}</div>}<div className="inline-form"><select className="app-select" value={selectedTest} onChange={(event) => setSelectedTest(event.target.value)}><option value="">Choose a test</option>{available.map((test) => <option key={test.id} value={test.id}>{test.name}</option>)}</select><Button className="signal-button" disabled={!selectedTest || addTest.isPending} onClick={() => { addTest.mutate(selectedTest); setSelectedTest(''); }}>Add test</Button></div></section>
    <section className="surface-panel"><div className="panel-heading"><div><h2>Run suite</h2><p className="muted-copy">Replay each test and evaluate the result.</p></div></div><div className="inline-form"><input className="app-input" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model" /><Button className="signal-button" disabled={run.isPending || suite.data.tests.length === 0} onClick={() => run.mutate({ model }, { onSuccess: (created) => setRunId(created.id) })}>Run suite</Button></div>{run.isError ? <p className="form-error" role="alert">Could not run suite: {run.error.message}</p> : null}{testRun.data ? <div className="run-summary"><strong>{testRun.data.status}</strong><span>{testRun.data.passedCount} passed</span><span>{testRun.data.failedCount} failed</span><span>{testRun.data.skippedCount} skipped</span><Link className="text-link-button" href={`/projects/${projectId}/tests/runs/${testRun.data.id}`}>Open results</Link></div> : null}</section>
  </div>;
}
