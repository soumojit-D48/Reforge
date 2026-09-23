import { BadRequestException } from '@nestjs/common';
import { ReplayFieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { resolveReplayFields } from './replay-resolution.js';

const base = {
  prompt: 'reused',
  tool_arguments: 'reused',
  retrieval: 'mocked',
  tool_response: 'mocked',
  model: 'reused',
  temperature: 'reused',
};

describe('resolveReplayFields', () => {
  it('allows exactly one changed field and labels the rest', () => {
    const result = resolveReplayFields(ReplayFieldType.model, {
      ...base,
      model: 'changed',
    });
    expect(result.model).toBe('changed');
    expect(result.retrieval).toBe('mocked');
  });

  it('maps retrieval_config to retrieval', () => {
    const result = resolveReplayFields(ReplayFieldType.retrieval_config, {
      ...base,
      retrieval: 'changed',
    });
    expect(result.retrieval).toBe('changed');
  });

  it.each([
    [ReplayFieldType.prompt, 'prompt'],
    [ReplayFieldType.model, 'model'],
    [ReplayFieldType.tool_arguments, 'tool_arguments'],
    [ReplayFieldType.retrieval_config, 'retrieval'],
    [ReplayFieldType.temperature, 'temperature'],
  ])('maps %s to the changed resolution field', (changedField, field) => {
    const result = resolveReplayFields(changedField, {
      ...base,
      [field]: 'changed',
    });
    expect(result[field as keyof typeof result]).toBe('changed');
  });

  it('rejects multiple changed fields', () => {
    expect(() =>
      resolveReplayFields(ReplayFieldType.model, {
        ...base,
        model: 'changed',
        prompt: 'changed',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects missing and unknown resolution fields', () => {
    expect(() =>
      resolveReplayFields(ReplayFieldType.model, {
        ...base,
        model: 'changed',
        temperature: undefined,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveReplayFields(ReplayFieldType.model, {
        ...base,
        model: 'changed',
        extra: 'reused',
      }),
    ).toThrow(BadRequestException);
  });
});
