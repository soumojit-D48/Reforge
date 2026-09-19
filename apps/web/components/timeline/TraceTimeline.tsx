'use client';

import type { TraceSpan } from '../../lib/api-client';
import { SpanNode } from './SpanNode';

export function TraceTimeline({ spans }: { spans: TraceSpan[] }): React.JSX.Element {
  if (spans.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No spans were recorded for this trace.</p>;
  }
  return (
    <div className="relative flex flex-col gap-3">
      <div className="absolute bottom-4 left-3 top-4 w-px bg-slate-200" aria-hidden="true" />
      {spans.map((span) => <SpanNode key={span.id} span={span} />)}
    </div>
  );
}
