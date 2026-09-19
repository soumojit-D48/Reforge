'use client';

import Link from 'next/link';
import { use } from 'react';
import { TraceTimeline } from '../../../../../../components/timeline/TraceTimeline';
import { useTrace } from '../../../../../../hooks/use-trace-query';

export default function TracePage({ params }: { params: Promise<{ projectId: string; traceId: string }> }): React.JSX.Element {
  const { projectId, traceId } = use(params);
  const trace = useTrace(traceId);

  if (trace.isPending) return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading trace…</p>;
  if (trace.isError) return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load trace: {trace.error.message}</p>;
  if (trace.data === undefined) return <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Trace data was empty.</p>;

  const item = trace.data;
  return (
    <div className="flex flex-col gap-8">
      <Link href={`/projects/${projectId}/runs`} className="text-sm font-semibold text-violet-700 hover:underline">← Back to runs</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-600">Trace detail</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{item.name}</h1><p className="mt-2 text-sm text-slate-500">{new Date(item.startedAt).toLocaleString()} · {item.environment ?? 'unknown environment'}</p></div>
        <span className="rounded-full bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white">{item.status}</span>
      </header>
      <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Duration</p><p className="mt-1 text-xl font-semibold">{item.totalDurationMs === null ? 'In progress' : `${item.totalDurationMs} ms`}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Estimated cost</p><p className="mt-1 text-xl font-semibold">{item.totalCost === null ? '—' : `$${item.totalCost}`}</p></div><div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Failure tags</p><p className="mt-1 text-xl font-semibold">{item.failureTags.length}</p></div></section>
      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="flex flex-col gap-4"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Trace input</h2><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(item.input, null, 2)}</pre></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Failure categories</h2>{item.failureTags.length === 0 ? <p className="mt-3 text-sm text-slate-500">No failure categories recorded.</p> : <div className="mt-3 flex flex-wrap gap-2">{item.failureTags.map((tag) => <span key={tag.id} className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">{tag.category} · {tag.source}{tag.confidence === null ? '' : ` · ${Math.round(tag.confidence * 100)}%`}</span>)}</div>}</div></div><div><h2 className="mb-4 text-xl font-semibold text-slate-950">Execution timeline</h2><TraceTimeline spans={item.spans} /></div></section>
    </div>
  );
}
