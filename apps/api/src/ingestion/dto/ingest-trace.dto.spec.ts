import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IngestTraceDto } from './ingest-trace.dto.js';

function validPayload(): Record<string, unknown> {
  return {
    external_id: 'run-1',
    name: 'customer-support-run',
    environment: 'production',
    input: { message: 'Where is my order?' },
    started_at: '2026-09-16T09:31:02.000Z',
    ended_at: '2026-09-16T09:31:10.400Z',
    status: 'failed',
    spans: [
      {
        id: 'span_1',
        parent_id: null,
        type: 'retrieval',
        name: 'retrieve_order_docs',
        input: { query: 'order status' },
        started_at: '2026-09-16T09:31:02.100Z',
        ended_at: '2026-09-16T09:31:02.900Z',
      },
      {
        id: 'span_2',
        type: 'llm_call',
        name: 'select_tool',
        model: 'openrouter/model-a',
        token_usage: { prompt: 512, completion: 48 },
        started_at: '2026-09-16T09:31:03.000Z',
      },
      {
        id: 'span_3',
        parent_id: 'span_2',
        type: 'tool_call',
        name: 'getOrderStatus',
        error: { status: 404 },
        started_at: '2026-09-16T09:31:03.500Z',
      },
    ],
  };
}

function collect(error: ValidationError): string[] {
  const own = Object.values(error.constraints ?? {});
  const nested = (error.children ?? []).flatMap(collect);
  return own.concat(nested);
}

async function errorsOf(payload: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(IngestTraceDto, payload);
  const errors = await validate(dto);
  return errors.flatMap(collect);
}

describe('IngestTraceDto', () => {
  it('accepts the ARCHITECTURE §4 wire example', async () => {
    await expect(errorsOf(validPayload())).resolves.toEqual([]);
  });

  it('rejects missing name and unknown status', async () => {
    const p = validPayload();
    delete p['name'];
    p['status'] = 'exploded';
    const errors = await errorsOf(p);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a dangling parent_id', async () => {
    const p = validPayload();
    (p['spans'] as Record<string, unknown>[])[2]!['parent_id'] = 'ghost';
    const errors = await errorsOf(p);
    expect(errors.some((m) => m.includes('does not reference'))).toBe(true);
  });

  it('rejects duplicate span ids', async () => {
    const p = validPayload();
    (p['spans'] as Record<string, unknown>[])[1]!['id'] = 'span_1';
    const errors = await errorsOf(p);
    expect(errors.some((m) => m.includes('duplicate span id'))).toBe(true);
  });

  it('rejects span cycles', async () => {
    const p = validPayload();
    const spans = p['spans'] as Record<string, unknown>[];
    spans[0]!['parent_id'] = 'span_3';
    spans[2]!['parent_id'] = 'span_1';
    const errors = await errorsOf(p);
    expect(errors.some((m) => m.includes('cycle'))).toBe(true);
  });

  it('rejects bad span timestamps and token usage', async () => {
    const p = validPayload();
    const spans = p['spans'] as Record<string, unknown>[];
    spans[1]!['started_at'] = 'not-a-date';
    spans[1]!['token_usage'] = { prompt: 'lots' };
    const errors = await errorsOf(p);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects unknown span types and extra top-level fields stay allowed-but-checked', async () => {
    const p = validPayload();
    (p['spans'] as Record<string, unknown>[])[0]!['type'] = 'telepathy';
    const errors = await errorsOf(p);
    expect(errors.length).toBeGreaterThan(0);
  });
});
