'use client';

import type { ReplayComparison, ReplayOutcome, ReplayResolutionValue, TraceComparison } from '../../lib/api-client';
import { FieldResolutionBadge } from './FieldResolutionBadge';

function display(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function ComparisonCell({ label, original, result }: { label: string; original: unknown; result: unknown }): React.JSX.Element {
  return <div className="compare-cell"><p className="mono">{label}</p><div className="compare-columns"><pre>{display(original)}</pre><pre>{display(result)}</pre></div></div>;
}

function TraceMetrics({ trace }: { trace: TraceComparison }): React.JSX.Element {
  return <div className="compare-metrics"><span><b>{trace.status}</b> status</span><span><b>{trace.latencyMs === null ? '—' : `${trace.latencyMs} ms`}</b> latency</span><span><b>{trace.cost === null ? '—' : `$${trace.cost}`}</b> cost</span><span><b>{trace.errors.length}</b> errors</span></div>;
}

export function CompareView({ comparison, onOutcome }: { comparison: ReplayComparison; onOutcome: (outcome: ReplayOutcome) => void }): React.JSX.Element {
  const resolutionEntries = Object.entries(comparison.replay.fieldResolution) as [string, ReplayResolutionValue][];
  return <div className="compare-view">
    <div className="compare-headings"><div><p className="mono">ORIGINAL</p><h2>{comparison.original.name}</h2><TraceMetrics trace={comparison.original} /></div><div><p className="mono">REPLAY RESULT</p><h2>{comparison.result.name}</h2><TraceMetrics trace={comparison.result} /></div></div>
    <section className="surface-panel compare-panel"><div className="panel-heading"><div><h2>Replay configuration</h2><p className="muted-copy">Every replay field remains explicit and traceable.</p></div></div><div className="compare-resolution-list">{resolutionEntries.map(([field, resolution]) => <FieldResolutionBadge key={field} field={field} resolution={resolution} />)}</div></section>
    <section className="surface-panel compare-panel"><div className="panel-heading"><h2>Output comparison</h2></div><div className="compare-grid"><ComparisonCell label="Final output" original={comparison.original.finalOutput} result={comparison.result.finalOutput} /><ComparisonCell label="Selected tool" original={comparison.original.selectedTool} result={comparison.result.selectedTool} /><ComparisonCell label="Tool arguments" original={comparison.original.toolArguments} result={comparison.result.toolArguments} /><ComparisonCell label="Retrieval documents" original={comparison.original.retrievalDocuments} result={comparison.result.retrievalDocuments} /><ComparisonCell label="Token usage" original={comparison.original.tokenUsage} result={comparison.result.tokenUsage} /><ComparisonCell label="Errors" original={comparison.original.errors} result={comparison.result.errors} /></div></section>
    <section className="surface-panel compare-panel"><div className="panel-heading"><h2>Span comparison</h2><span className="mono">{comparison.original.spans.length} → {comparison.result.spans.length} SPANS</span></div><div className="span-compare-list">{Array.from({ length: Math.max(comparison.original.spans.length, comparison.result.spans.length) }, (_, index) => { const original = comparison.original.spans[index]; const result = comparison.result.spans[index]; return <div className="span-compare-row" key={`${original?.id ?? 'missing'}-${result?.id ?? 'missing'}`}><div><p className="mono">ORIGINAL</p><strong>{original?.name ?? 'No span'}</strong><small>{original?.type ?? '—'} · {original?.durationMs === null || original?.durationMs === undefined ? '—' : `${original.durationMs} ms`}</small></div><div><p className="mono">REPLAY</p><strong>{result?.name ?? 'No span'}</strong><small>{result?.type ?? '—'} · {result?.durationMs === null || result?.durationMs === undefined ? '—' : `${result.durationMs} ms`}</small></div></div>; })}</div></section>
    <section className="surface-panel compare-outcome"><div><p className="mono">OUTCOME</p><h2>{comparison.replay.outcome === null ? 'Not marked yet' : comparison.replay.outcome.replace('_', ' ')}</h2></div><div className="outcome-actions">{(['fixed', 'partially_fixed', 'not_fixed', 'new_failure'] as ReplayOutcome[]).map((outcome) => <button type="button" className={comparison.replay.outcome === outcome ? 'outcome-button outcome-selected' : 'outcome-button'} key={outcome} onClick={() => onOutcome(outcome)}>{outcome.replace('_', ' ')}</button>)}</div></section>
  </div>;
}
