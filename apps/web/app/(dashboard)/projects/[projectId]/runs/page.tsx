'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import type { TraceListFilters, TraceStatus } from '../../../../../lib/api-client';
import { useTraceList } from '../../../../../hooks/use-trace-query';
import { Button } from '../../../../../components/ui/button';
import { ArrowRight, ListFilter, SlidersHorizontal } from 'lucide-react';

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
    <div className="dashboard-page runs-page">
      <header className="page-intro page-intro-wide">
        <div>
          <p className="page-kicker mono">TRACE WORKSPACE / LIVE HISTORY</p>
          <h1>Runs</h1>
          <p>Inspect execution history, follow nested spans, and find the run worth replaying.</p>
        </div>
        <Link href={`/projects/${projectId}`} className="outline-link"><SlidersHorizontal /> Project settings</Link>
      </header>
      <form onSubmit={applyFilters} className="filters-panel">
        <div className="filters-heading"><ListFilter /><span className="mono">FILTER EXECUTION HISTORY</span></div>
        <select value={draft.status ?? ''} onChange={(event) => setDraft({ ...draft, status: event.target.value === '' ? undefined : event.target.value as TraceStatus })} className="app-select">
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
        </select>
        <input value={draft.environment ?? ''} onChange={(event) => setDraft({ ...draft, environment: event.target.value || undefined })} placeholder="Environment" className="app-input" />
        <input value={draft.model ?? ''} onChange={(event) => setDraft({ ...draft, model: event.target.value || undefined })} placeholder="Model" className="app-input" />
        <input value={draft.errorType ?? ''} onChange={(event) => setDraft({ ...draft, errorType: event.target.value || undefined })} placeholder="Span type" className="app-input" />
        <input type="date" value={draft.from?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, from: event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined })} className="app-input" />
        <input type="date" value={draft.to?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, to: event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined })} className="app-input" />
        <input type="number" min={1} max={100} value={draft.limit ?? 20} onChange={(event) => setDraft({ ...draft, limit: Number(event.target.value) })} aria-label="Page size" className="app-input" />
        <Button type="submit" className="signal-button">Apply filters</Button>
      </form>
      {traces.isPending && <p className="state-panel">Loading runs…</p>}
      {traces.isError && <p className="state-panel state-error" role="alert">Could not load runs: {traces.error.message}</p>}
      {traces.data !== undefined && traces.data.items.length === 0 && <p className="state-panel state-empty">No runs match these filters.</p>}
      {traces.data !== undefined && traces.data.items.length > 0 && (
        <>
          <div className="runs-table">
            <div className="runs-table-head"><span>RUN</span><span>STATUS</span><span>ENVIRONMENT</span><span>DURATION</span><span>FAILURE</span></div>
            {traces.data.items.map((trace) => <Link key={trace.id} href={`/projects/${projectId}/traces/${trace.id}`} className="run-row"><span><strong>{trace.name}</strong><small>{new Date(trace.startedAt).toLocaleString()}</small></span><span><span className={`run-status run-status-${trace.status}`}>{trace.status.replace('_', ' ')}</span>{trace.replayStatus !== null ? <small className="replay-status">REPLAY / {trace.replayStatus}</small> : null}</span><span>{trace.environment ?? '—'}</span><span>{trace.totalDurationMs === null ? '—' : `${trace.totalDurationMs} ms`}</span><span>{trace.failureCategories.join(', ') || 'None'}</span><ArrowRight /></Link>)}
          </div>
          <div className="pagination-row"><Button type="button" variant="outline" disabled={traces.data.nextCursor === null || traces.isFetching} onClick={() => setFilters({ ...filters, cursor: traces.data?.nextCursor ?? undefined })}>Next page <ArrowRight /></Button></div>
        </>
      )}
    </div>
  );
}
