'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import type { TraceListFilters, TraceStatus } from '../../../../../lib/api-client';
import { useTraceList } from '../../../../../hooks/use-trace-query';

const statuses: TraceStatus[] = ['running', 'success', 'failed', 'processing_error'];

export default function RunsPage({ params }: { params: Promise<{ projectId: string }> }): React.JSX.Element {
  const { projectId } = use(params);
  const [filters, setFilters] = useState<TraceListFilters>({ limit: 20 });
  const [draft, setDraft] = useState<TraceListFilters>({ limit: 20 });
  const traces = useTraceList(projectId, filters);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...draft, cursor: undefined, limit: draft.limit ?? 20 });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-600">Trace workspace</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">Runs</h1>
          <p className="mt-2 max-w-xl text-slate-600">Inspect the execution history of this project, then open any run to follow its span tree.</p>
        </div>
        <Link href={`/projects/${projectId}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-950 hover:text-slate-950">Project settings</Link>
      </header>
      <form onSubmit={applyFilters} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <select value={draft.status ?? ''} onChange={(event) => setDraft({ ...draft, status: event.target.value === '' ? undefined : event.target.value as TraceStatus })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
        </select>
        <input value={draft.environment ?? ''} onChange={(event) => setDraft({ ...draft, environment: event.target.value || undefined })} placeholder="Environment" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={draft.model ?? ''} onChange={(event) => setDraft({ ...draft, model: event.target.value || undefined })} placeholder="Model" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={draft.errorType ?? ''} onChange={(event) => setDraft({ ...draft, errorType: event.target.value || undefined })} placeholder="Span type" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={draft.from?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, from: event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={draft.to?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, to: event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="number" min={1} max={100} value={draft.limit ?? 20} onChange={(event) => setDraft({ ...draft, limit: Number(event.target.value) })} aria-label="Page size" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">Apply filters</button>
      </form>
      {traces.isPending && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading runs…</p>}
      {traces.isError && <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load runs: {traces.error.message}</p>}
      {traces.data !== undefined && traces.data.items.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No runs match these filters.</p>}
      {traces.data !== undefined && traces.data.items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[1.7fr_0.8fr_0.8fr_0.8fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>Run</span><span>Status</span><span>Environment</span><span>Duration</span><span>Failure</span></div>
            {traces.data.items.map((trace) => <Link key={trace.id} href={`/projects/${projectId}/traces/${trace.id}`} className="grid gap-2 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-violet-50 md:grid-cols-[1.7fr_0.8fr_0.8fr_0.8fr_1fr] md:items-center md:gap-4"><span><span className="block font-semibold text-slate-950">{trace.name}</span><span className="block text-xs text-slate-500">{new Date(trace.startedAt).toLocaleString()}</span></span><span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{trace.status}</span><span className="text-sm text-slate-600">{trace.environment ?? '—'}</span><span className="text-sm text-slate-600">{trace.totalDurationMs === null ? '—' : `${trace.totalDurationMs} ms`}</span><span className="text-sm text-slate-600">{trace.failureCategories.join(', ') || 'None'}</span></Link>)}
          </div>
          <div className="flex justify-end"><button type="button" disabled={traces.data.nextCursor === null || traces.isFetching} onClick={() => setFilters({ ...filters, cursor: traces.data?.nextCursor ?? undefined })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next page</button></div>
        </>
      )}
    </div>
  );
}
