'use client';

import { useState } from 'react';
import type { TraceSpan } from '../../lib/api-client';

function valueText(value: unknown): string {
  if (value === null || value === undefined) {
    return 'None';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function statusTone(type: string): string {
  if (type === 'error') return 'border-red-300 bg-red-50';
  if (type === 'tool_call') return 'border-amber-300 bg-amber-50';
  if (type === 'llm_call') return 'border-violet-300 bg-violet-50';
  return 'border-slate-200 bg-white';
}

export function SpanNode({ span, depth = 0 }: { span: TraceSpan; depth?: number }): React.JSX.Element {
  const [open, setOpen] = useState(depth < 2);
  const [selected, setSelected] = useState(false);
  return (
    <div className="flex flex-col gap-2" style={{ marginLeft: `${depth * 1.25}rem` }}>
      <button
        type="button"
        onClick={() => setSelected((value) => !value)}
        className={`w-full rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${statusTone(span.type)}`}
        aria-expanded={selected}
      >
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-950">{span.name}</span>
          <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-medium text-white">
            {span.type}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          <span>{span.durationMs === null ? 'In progress' : `${span.durationMs} ms`}</span>
          {span.model !== null && <span>{span.model}</span>}
          {span.promptVersion !== null && <span>Prompt {span.promptVersion}</span>}
        </span>
      </button>
      {selected && (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm text-slate-100 md:grid-cols-2">
          {[
            { label: 'Input', value: span.input },
            { label: 'Output', value: span.output },
            { label: 'Arguments', value: span.arguments },
            { label: 'Result', value: span.result },
            { label: 'Error', value: span.error },
            { label: 'Token usage', value: span.tokenUsage },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{valueText(value)}</pre>
            </div>
          ))}
        </div>
      )}
      {span.children.length > 0 && (
        <div className="flex flex-col gap-2 border-l border-slate-300 pl-3">
          <button type="button" onClick={() => setOpen((value) => !value)} className="self-start text-xs font-semibold text-slate-500 hover:text-slate-950">
            {open ? 'Hide' : 'Show'} {span.children.length} child span{span.children.length === 1 ? '' : 's'}
          </button>
          {open && span.children.map((child) => <SpanNode key={child.id} span={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}
