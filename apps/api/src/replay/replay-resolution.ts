import { BadRequestException } from '@nestjs/common';
import { ReplayFieldType } from '@prisma/client';
import {
  REPLAY_RESOLUTION_VALUES,
  type ReplayResolutionInput,
  type ReplayResolutionValue,
} from './dto/create-replay.dto.js';

export const RESOLUTION_FIELDS = [
  'prompt',
  'tool_arguments',
  'retrieval',
  'tool_response',
  'model',
  'temperature',
] as const;

export type ResolutionField = (typeof RESOLUTION_FIELDS)[number];
export type ReplayResolution = Record<ResolutionField, ReplayResolutionValue>;

const CHANGED_FIELD_TO_RESOLUTION: Record<ReplayFieldType, ResolutionField> = {
  prompt: 'prompt',
  model: 'model',
  tool_arguments: 'tool_arguments',
  retrieval_config: 'retrieval',
  temperature: 'temperature',
};

export function resolveReplayFields(
  changedField: ReplayFieldType,
  fieldResolution: ReplayResolutionInput,
): ReplayResolution {
  const keys = Object.keys(fieldResolution);
  const unknownKeys = keys.filter(
    (key): key is string => !RESOLUTION_FIELDS.includes(key as ResolutionField),
  );
  const missingKeys = RESOLUTION_FIELDS.filter((field) => !keys.includes(field));
  if (unknownKeys.length > 0 || missingKeys.length > 0) {
    throw new BadRequestException(
      `fieldResolution must contain exactly: ${RESOLUTION_FIELDS.join(', ')}`,
    );
  }

  const changedResolutionField = CHANGED_FIELD_TO_RESOLUTION[changedField];
  const result = {} as ReplayResolution;
  for (const field of RESOLUTION_FIELDS) {
    const value = fieldResolution[field];
    if (
      typeof value !== 'string' ||
      !REPLAY_RESOLUTION_VALUES.includes(value as ReplayResolutionValue)
    ) {
      throw new BadRequestException(
        `${field} resolution must be changed, reused, mocked, or fresh`,
      );
    }
    if (field === changedResolutionField && value !== 'changed') {
      throw new BadRequestException(
        `${field} must resolve to changed because it is the changed field`,
      );
    }
    if (field !== changedResolutionField && value === 'changed') {
      throw new BadRequestException(
        `Only ${changedResolutionField} may resolve to changed`,
      );
    }
    result[field] = value as ReplayResolutionValue;
  }
  return result;
}
