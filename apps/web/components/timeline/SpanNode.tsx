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
  if (type === 'error') return 'span-error';
  if (type === 'tool_call') return 'span-tool';
  if (type === 'llm_call') return 'span-llm';
  return 'span-default';
}

export function SpanNode({ span, depth = 0 }: { span: TraceSpan; depth?: number }): React.JSX.Element {
  const [open, setOpen] = useState(depth < 2);
  const [selected, setSelected] = useState(false);
  return (
    <div className="span-node" style={{ marginLeft: `${depth * 1.25}rem` }}>
      <button
        type="button"
        onClick={() => setSelected((value) => !value)}
        className={`span-trigger ${statusTone(span.type)}`}
        aria-expanded={selected}
      >
        <span className="span-heading">
          <span className="span-name">{span.name}</span>
          <span className="span-type mono">
            {span.type}
          </span>
        </span>
        <span className="span-meta">
          <span>{span.durationMs === null ? 'In progress' : `${span.durationMs} ms`}</span>
          {span.model !== null && <span>{span.model}</span>}
          {span.promptVersion !== null && <span>Prompt {span.promptVersion}</span>}
        </span>
      </button>
      {selected && (
        <div className="span-details">
          {[
            { label: 'Input', value: span.input },
            { label: 'Output', value: span.output },
            { label: 'Arguments', value: span.arguments },
            { label: 'Result', value: span.result },
            { label: 'Error', value: span.error },
            { label: 'Token usage', value: span.tokenUsage },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="span-detail-label mono">{label}</p>
              <pre className="span-detail-value">{valueText(value)}</pre>
            </div>
          ))}
        </div>
      )}
      {span.children.length > 0 && (
        <div className="span-children">
          <button type="button" onClick={() => setOpen((value) => !value)} className="text-link-button">
            {open ? 'Hide' : 'Show'} {span.children.length} child span{span.children.length === 1 ? '' : 's'}
          </button>
          {open && span.children.map((child) => <SpanNode key={child.id} span={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}
