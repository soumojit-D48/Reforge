'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { TraceTimeline } from '../../../../../../components/timeline/TraceTimeline';
import {
  useFailureTagMutation,
  useTrace,
} from '../../../../../../hooks/use-trace-query';
import type { FailureCategory } from '../../../../../../lib/api-client';
import { Button } from '../../../../../../components/ui/button';
import { ArrowLeft, Check, CircleAlert, Clock3, DollarSign, GitBranch, Save } from 'lucide-react';

const FAILURE_CATEGORIES: { value: FailureCategory; label: string }[] = [
  { value: 'bad_retrieval', label: 'Bad retrieval' },
  { value: 'wrong_tool', label: 'Wrong tool' },
  { value: 'invalid_tool_args', label: 'Invalid tool arguments' },
  { value: 'external_api_failure', label: 'External API failure' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'hallucination', label: 'Hallucination' },
  { value: 'prompt_injection', label: 'Prompt injection' },
  { value: 'evaluator_error', label: 'Evaluator error' },
  { value: 'unknown', label: 'Unknown' },
];

function categoryLabel(category: FailureCategory): string {
  return FAILURE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export default function TracePage({
  params,
}: {
  params: Promise<{ projectId: string; traceId: string }>;
}): React.JSX.Element {
  const { projectId, traceId } = use(params);
  const trace = useTrace(traceId);
  const tagMutation = useFailureTagMutation(traceId);
  const [category, setCategory] = useState<FailureCategory>('unknown');
  const [note, setNote] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  if (trace.isPending) {
    return <p className="state-panel trace-state">Loading trace...</p>;
  }
  if (trace.isError) {
    return <p className="state-panel state-error trace-state" role="alert">Could not load trace: {trace.error.message}</p>;
  }
  if (trace.data === undefined) {
    return <p className="state-panel state-error trace-state" role="alert">Trace data was empty.</p>;
  }

  const item = trace.data;
  const submitTag = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    tagMutation.mutate(
      { tagId: editingTagId ?? undefined, category, note },
      {
        onSuccess: () => {
          setEditingTagId(null);
          setCategory('unknown');
          setNote('');
        },
      },
    );
  };

  const editTag = (tag: (typeof item.failureTags)[number]): void => {
    if (tag.source !== 'human') return;
    setEditingTagId(tag.id);
    setCategory(tag.category);
    setNote(tag.note ?? '');
  };

  return (
    <div className="dashboard-page trace-page">
      <Link href={`/projects/${projectId}/runs`} className="back-link"><ArrowLeft /> Back to runs</Link>
      <header className="page-intro page-intro-wide">
        <div>
          <p className="page-kicker mono">TRACE DETAIL / {item.id.slice(0, 8)}</p>
          <h1>{item.name}</h1>
          <p>{new Date(item.startedAt).toLocaleString()} · {item.environment ?? 'unknown environment'}</p>
        </div>
        <span className={`run-status run-status-${item.status}`}>{item.status.replace('_', ' ')}</span>
      </header>
      <section className="metric-grid">
        <div className="metric-card"><Clock3 /><p className="mono">DURATION</p><strong>{item.totalDurationMs === null ? 'In progress' : `${item.totalDurationMs} ms`}</strong></div>
        <div className="metric-card"><DollarSign /><p className="mono">ESTIMATED COST</p><strong>{item.totalCost === null ? '—' : `$${item.totalCost}`}</strong></div>
        <div className="metric-card"><CircleAlert /><p className="mono">FAILURE TAGS</p><strong>{item.failureTags.length}</strong></div>
      </section>
      <section className="trace-layout">
        <div className="trace-sidebar">
          <div className="surface-panel">
            <h2>Trace input</h2>
            <pre className="json-block">{JSON.stringify(item.input, null, 2)}</pre>
          </div>
          <div className="surface-panel">
            <div className="panel-heading"><h2>Failure categories</h2><span className="mono">AI + HUMAN</span></div>
            {item.failureTags.length === 0 ? <p className="muted-copy">No failure categories recorded.</p> : <div className="tag-list">{item.failureTags.map((tag) => <div key={tag.id} className={`tag-card tag-${tag.source}`}><div className="tag-heading"><span>{categoryLabel(tag.category)}</span><b className="mono">{tag.source}</b></div>{tag.note === null ? null : <p>{tag.note}</p>}<div className="tag-meta"><span>{tag.confidence === null ? '' : `${Math.round(tag.confidence * 100)}% confidence`}</span>{tag.source === 'human' ? <button type="button" className="text-link-button" onClick={() => editTag(tag)}>Edit</button> : null}</div></div>)}</div>}
          </div>
          <form onSubmit={submitTag} className="surface-panel tag-form">
            <div className="panel-heading"><h2>{editingTagId === null ? 'Add human tag' : 'Edit human tag'}</h2>{editingTagId === null ? null : <button type="button" className="text-link-button" onClick={() => { setEditingTagId(null); setCategory('unknown'); setNote(''); }}>Cancel</button>}</div>
            <label className="form-field" htmlFor="failure-category">Category<select id="failure-category" value={category} onChange={(event) => setCategory(event.target.value as FailureCategory)} className="app-select">
              {FAILURE_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <label className="form-field" htmlFor="failure-note">Note<textarea id="failure-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} className="app-input" placeholder="What caused this failure?" /></label>
            {tagMutation.isError ? <p className="form-error" role="alert">Could not save tag: {tagMutation.error.message}</p> : null}
            {tagMutation.isSuccess ? <p className="form-success"><Check /> Human tag saved.</p> : null}
            <Button type="submit" disabled={tagMutation.isPending} className="signal-button"><Save /> {tagMutation.isPending ? 'Saving...' : editingTagId === null ? 'Save human tag' : 'Update human tag'}</Button>
          </form>
        </div>
        <div className="timeline-panel"><div className="panel-heading"><h2>Execution timeline</h2><span className="mono"><GitBranch /> {item.spans.length} SPANS</span></div><TraceTimeline spans={item.spans} /></div>
      </section>
    </div>
  );
}
