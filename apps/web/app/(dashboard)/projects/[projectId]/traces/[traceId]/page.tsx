'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { TraceTimeline } from '../../../../../../components/timeline/TraceTimeline';
import {
  useFailureTagMutation,
  useTrace,
} from '../../../../../../hooks/use-trace-query';
import type { FailureCategory } from '../../../../../../lib/api-client';

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
    return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading trace...</p>;
  }
  if (trace.isError) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load trace: {trace.error.message}</p>;
  }
  if (trace.data === undefined) {
    return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Trace data was empty.</p>;
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
    <div className="flex flex-col gap-8">
      <Link href={`/projects/${projectId}/runs`} className="text-sm font-semibold text-violet-700 hover:underline">&larr; Back to runs</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-600">Trace detail</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{item.name}</h1>
          <p className="mt-2 text-sm text-slate-500">{new Date(item.startedAt).toLocaleString()} · {item.environment ?? 'unknown environment'}</p>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">{item.status}</span>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Duration</p><p className="mt-1 text-xl font-semibold">{item.totalDurationMs === null ? 'In progress' : `${item.totalDurationMs} ms`}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Estimated cost</p><p className="mt-1 text-xl font-semibold">{item.totalCost === null ? '—' : `$${item.totalCost}`}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Failure tags</p><p className="mt-1 text-xl font-semibold">{item.failureTags.length}</p></div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-950">Trace input</h2>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(item.input, null, 2)}</pre>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-950">Failure categories</h2>
              <span className="text-xs text-slate-500">AI suggestions and human overrides</span>
            </div>
            {item.failureTags.length === 0 ? <p className="mt-3 text-sm text-slate-500">No failure categories recorded.</p> : <div className="mt-3 flex flex-col gap-3">{item.failureTags.map((tag) => <div key={tag.id} className={`rounded-lg border p-3 ${tag.source === 'human' ? 'border-violet-200 bg-violet-50' : 'border-red-200 bg-red-50'}`}><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{categoryLabel(tag.category)}</span><span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{tag.source}</span></div>{tag.note === null ? null : <p className="mt-2 text-sm text-slate-700">{tag.note}</p>}<div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{tag.confidence === null ? '' : `${Math.round(tag.confidence * 100)}% confidence`}</span>{tag.source === 'human' ? <button type="button" className="font-semibold text-violet-700 hover:underline" onClick={() => editTag(tag)}>Edit</button> : null}</div></div>)}</div>}
          </div>
          <form onSubmit={submitTag} className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">{editingTagId === null ? 'Add human tag' : 'Edit human tag'}</h2>{editingTagId === null ? null : <button type="button" className="text-xs font-semibold text-slate-600 hover:underline" onClick={() => { setEditingTagId(null); setCategory('unknown'); setNote(''); }}>Cancel</button>}</div>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="failure-category">Category</label>
            <select id="failure-category" value={category} onChange={(event) => setCategory(event.target.value as FailureCategory)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900">
              {FAILURE_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="failure-note">Note</label>
            <textarea id="failure-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" placeholder="What caused this failure?" />
            {tagMutation.isError ? <p className="mt-2 text-sm text-red-700">Could not save tag: {tagMutation.error.message}</p> : null}
            {tagMutation.isSuccess ? <p className="mt-2 text-sm text-emerald-700">Human tag saved.</p> : null}
            <button type="submit" disabled={tagMutation.isPending} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">{tagMutation.isPending ? 'Saving...' : editingTagId === null ? 'Save human tag' : 'Update human tag'}</button>
          </form>
        </div>
        <div><h2 className="mb-4 text-xl font-semibold text-slate-950">Execution timeline</h2><TraceTimeline spans={item.spans} /></div>
      </section>
    </div>
  );
}
