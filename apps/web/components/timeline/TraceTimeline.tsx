'use client';

import type { TraceSpan } from '../../lib/api-client';
import { SpanNode } from './SpanNode';

export function TraceTimeline({ spans }: { spans: TraceSpan[] }): React.JSX.Element {
  if (spans.length === 0) {
    return <p className="state-panel state-empty">No spans were recorded for this trace.</p>;
  }
  return (
    <div className="trace-timeline">
      <div className="trace-timeline-line" aria-hidden="true" />
      {spans.map((span) => <SpanNode key={span.id} span={span} />)}
    </div>
  );
}
