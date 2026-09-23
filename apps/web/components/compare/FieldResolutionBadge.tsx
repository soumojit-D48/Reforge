'use client';

import type { ReplayResolutionValue } from '../../lib/api-client';

export function FieldResolutionBadge({
  field,
  resolution,
}: {
  field: string;
  resolution: ReplayResolutionValue;
}): React.JSX.Element {
  return <span className={`compare-resolution compare-resolution-${resolution}`}><b>{field}</b> {resolution}</span>;
}
