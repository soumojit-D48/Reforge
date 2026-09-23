'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { TraceTimeline } from '../../../../../../components/timeline/TraceTimeline';
import {
  useFailureTagMutation,
  useTrace,
} from '../../../../../../hooks/use-trace-query';
import {
  useReplayMutation,
  useReplayStatus,
} from '../../../../../../hooks/use-replay-mutation';
import type {
  FailureCategory,
  ReplayField,
  ReplayResolution,
  ReplayResolutionValue,
} from '../../../../../../lib/api-client';
import { Button } from '../../../../../../components/ui/button';
import { ArrowLeft, Check, CircleAlert, Clock3, DollarSign, GitBranch, Play, Save } from 'lucide-react';

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

const REPLAY_FIELDS: { value: ReplayField; label: string; resolution: keyof ReplayResolution }[] = [
  { value: 'prompt', label: 'Prompt', resolution: 'prompt' },
  { value: 'model', label: 'Model', resolution: 'model' },
  { value: 'tool_arguments', label: 'Tool arguments', resolution: 'tool_arguments' },
  { value: 'retrieval_config', label: 'Retrieval config', resolution: 'retrieval' },
  { value: 'temperature', label: 'Temperature', resolution: 'temperature' },
];
const RESOLUTION_FIELDS: { key: keyof ReplayResolution; label: string }[] = [
  { key: 'prompt', label: 'Prompt' },
  { key: 'tool_arguments', label: 'Tool arguments' },
  { key: 'retrieval', label: 'Retrieval' },
  { key: 'tool_response', label: 'Tool response' },
  { key: 'model', label: 'Model' },
  { key: 'temperature', label: 'Temperature' },
];
const RESOLUTION_VALUES: ReplayResolutionValue[] = ['reused', 'mocked', 'fresh'];

export default function TracePage({
  params,
}: {
  params: Promise<{ projectId: string; traceId: string }>;
}): React.JSX.Element {
  const { projectId, traceId } = use(params);
  const trace = useTrace(traceId);
  const tagMutation = useFailureTagMutation(traceId);
  const replayMutation = useReplayMutation(traceId);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);
  const replayStatus = useReplayStatus(activeReplayId);
  const [category, setCategory] = useState<FailureCategory>('unknown');
  const [note, setNote] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [changedField, setChangedField] = useState<ReplayField>('model');
  const [changedValue, setChangedValue] = useState('');
  const [fieldResolution, setFieldResolution] = useState<ReplayResolution>({
    prompt: 'reused',
    tool_arguments: 'reused',
    retrieval: 'mocked',
    tool_response: 'mocked',
    model: 'changed',
    temperature: 'reused',
  });

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

  const changeReplayField = (field: ReplayField): void => {
    const nextResolution = { ...fieldResolution };
    const previous = REPLAY_FIELDS.find((entry) => entry.value === changedField);
    const next = REPLAY_FIELDS.find((entry) => entry.value === field);
    if (previous !== undefined) nextResolution[previous.resolution] = 'reused';
    if (next !== undefined) nextResolution[next.resolution] = 'changed';
    setChangedField(field);
    setFieldResolution(nextResolution);
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
      {item.replay !== null ? <section className="replay-result-banner"><div><p className="mono">REPLAY EXECUTION</p><strong>{item.replay.status}</strong><span>Changed {item.replay.changedField}</span></div><div className="replay-resolution-summary">{Object.entries(item.replay.fieldResolution).map(([field, value]) => <span key={field} className={`resolution-chip resolution-${String(value)}`}><b>{field}</b> {String(value)}</span>)}</div></section> : null}
      <section className="metric-grid">
        <div className="metric-card"><Clock3 /><p className="mono">DURATION</p><strong>{item.totalDurationMs === null ? 'In progress' : `${item.totalDurationMs} ms`}</strong></div>
        <div className="metric-card"><DollarSign /><p className="mono">ESTIMATED COST</p><strong>{item.totalCost === null ? '—' : `$${item.totalCost}`}</strong></div>
        <div className="metric-card"><CircleAlert /><p className="mono">FAILURE TAGS</p><strong>{item.failureTags.length}</strong></div>
      </section>
      <section className="surface-panel replay-form">
        <div className="panel-heading"><div><h2>Replay this trace</h2><p className="muted-copy">Change exactly one field and explicitly resolve every other field.</p></div><Play /></div>
        <div className="replay-grid">
          <label className="form-field">Changed field<select value={changedField} onChange={(event) => changeReplayField(event.target.value as ReplayField)} className="app-select">{REPLAY_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}</select></label>
          <label className="form-field">Changed value<input value={changedValue} onChange={(event) => setChangedValue(event.target.value)} className="app-input" placeholder={changedField === 'model' ? 'openai/gpt-4o-mini' : 'Replacement value'} required /></label>
        </div>
        <div className="resolution-grid">{RESOLUTION_FIELDS.map((field) => <label key={field.key} className="form-field">{field.label}<select value={fieldResolution[field.key]} onChange={(event) => setFieldResolution({ ...fieldResolution, [field.key]: event.target.value as ReplayResolutionValue })} disabled={fieldResolution[field.key] === 'changed'} className="app-select"><option value="changed">Changed</option>{RESOLUTION_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div>
        {replayMutation.isError ? <p className="form-error" role="alert">Could not start replay: {replayMutation.error.message}</p> : null}
        {replayStatus.isError ? <p className="form-error" role="alert">Could not check replay status: {replayStatus.error.message}</p> : null}
        {replayStatus.data !== undefined ? <div className={`replay-live-status replay-live-${replayStatus.data.status}`}><span><b>Replay {replayStatus.data.status}</b>{replayStatus.data.status === 'queued' || replayStatus.data.status === 'running' ? ' — processing in the background...' : null}</span>{replayStatus.data.resultTraceId !== null ? <Link href={`/projects/${projectId}/traces/${replayStatus.data.resultTraceId}`} className="text-link-button">Open replay result <ArrowLeft className="rotate-180" /></Link> : null}</div> : null}
        <Button type="button" className="signal-button" disabled={replayMutation.isPending || (replayStatus.data?.status === 'queued' || replayStatus.data?.status === 'running') || changedValue.trim() === ''} onClick={() => replayMutation.mutate({ changedField, changedValue, fieldResolution }, { onSuccess: (replay) => setActiveReplayId(replay.id) })}><Play /> {replayMutation.isPending ? 'Starting replay...' : replayStatus.data?.status === 'completed' ? 'Start another replay' : 'Start replay'}</Button>
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
