'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useCreateTestSuite, useRegressionTests, useTestSuites } from '../../../../../hooks/use-regression';
import { ApiError } from '../../../../../lib/api-client';
import { Button } from '../../../../../components/ui/button';

export default function TestsPage({ params }: { params: Promise<{ projectId: string }> }): React.JSX.Element {
  const { projectId } = use(params);
  const tests = useRegressionTests(projectId);
  const suites = useTestSuites(projectId);
  const createSuite = useCreateTestSuite(projectId);
  const [suiteName, setSuiteName] = useState('Release guardrails');

  if (tests.isPending || suites.isPending) return <p className="state-panel trace-state">Loading regression tests...</p>;
  if (tests.isError || suites.isError) return <p className="state-panel state-error trace-state" role="alert">Could not load tests: {(tests.error ?? suites.error as ApiError).message}</p>;

  return <div className="dashboard-page tests-page">
    <header className="page-intro page-intro-wide"><div><p className="page-kicker mono">REGRESSION WORKSPACE</p><h1>Tests & suites</h1><p>Keep fixed agent failures from returning.</p></div></header>
    <section className="surface-panel">
      <div className="panel-heading"><div><h2>Regression tests</h2><p className="muted-copy">Save tests from a trace or replay detail page.</p></div><span className="mono">{tests.data.length} TESTS</span></div>
      {tests.data.length === 0 ? <p className="muted-copy">No regression tests yet.</p> : <div className="regression-list">{tests.data.map((test) => <div className="regression-row" key={test.id}><div><strong>{test.name}</strong><p>{test.expectedBehavior}</p></div><span className="mono">{Math.round(test.minScore * 100)}% MIN</span></div>)}</div>}
    </section>
    <section className="surface-panel">
      <div className="panel-heading"><div><h2>Test suites</h2><p className="muted-copy">Group tests and run them against a chosen model.</p></div></div>
      <form className="inline-form" onSubmit={(event) => { event.preventDefault(); createSuite.mutate(suiteName); }}><input className="app-input" value={suiteName} onChange={(event) => setSuiteName(event.target.value)} required /><Button className="signal-button" type="submit" disabled={createSuite.isPending}>Create suite</Button></form>
      {createSuite.isError ? <p className="form-error" role="alert">Could not create suite: {createSuite.error.message}</p> : null}
      <div className="regression-list">{suites.data.map((suite) => <div className="regression-row" key={suite.id}><div><strong>{suite.name}</strong><p>{suite.testCount} tests</p></div><Link className="text-link-button" href={`/projects/${projectId}/tests/suites/${suite.id}`}>Open suite</Link></div>)}</div>
    </section>
  </div>;
}
