import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import type { SpanDto } from './span.dto.js';

/**
 * Class-level span-tree integrity (ARCHITECTURE §4 validation rules):
 * ids unique, every parent_id resolves within the payload, no self-parent,
 * no cycles. Structural field checks live on SpanDto itself.
 */
@ValidatorConstraint({ name: 'spanTree', async: false })
@Injectable()
export class SpanTreeConstraint implements ValidatorConstraintInterface {
  validate(spans: unknown): boolean {
    return firstTreeError(spans) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    const err = firstTreeError(args.value);
    return `spans: ${err ?? 'invalid span tree'}`;
  }
}

export function firstTreeError(spans: unknown): string | null {
  if (!Array.isArray(spans)) {
    return null;
  }
  const list = spans as SpanDto[];
  const ids = new Set<string>();
  for (const span of list) {
    if (typeof span?.id === 'string') {
      if (ids.has(span.id)) {
        return `duplicate span id "${span.id}"`;
      }
      ids.add(span.id);
    }
  }
  for (const span of list) {
    const parentId = span?.parentId;
    if (parentId === undefined || parentId === null) {
      continue;
    }
    if (!ids.has(parentId)) {
      return `parent_id "${parentId}" does not reference a span in this payload`;
    }
    if (parentId === span?.id) {
      return `span "${span?.id ?? '?'}" cannot be its own parent`;
    }
  }
  // Cycle detection: walk up from every span; a repeated ancestor = cycle.
  const parentOf = new Map<string, string>();
  for (const span of list) {
    if (typeof span?.id === 'string' && typeof span?.parentId === 'string') {
      parentOf.set(span.id, span.parentId);
    }
  }
  for (const start of parentOf.keys()) {
    const seen = new Set<string>([start]);
    let current = parentOf.get(start);
    while (current !== undefined) {
      if (seen.has(current)) {
        return `span cycle detected at "${current}"`;
      }
      seen.add(current);
      current = parentOf.get(current);
    }
  }
  return null;
}
