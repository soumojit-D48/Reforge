import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  OpenRouterError,
  OpenRouterService,
  type ClassifyInput,
} from './openrouter.service.js';

const INPUT: ClassifyInput = {
  traceName: 'support-run',
  status: 'failed',
  spanSummaries: ['tool_call getOrderStatus'],
  errorExcerpts: ['404 Order not found'],
};

function serviceWith(env: Record<string, string | undefined>): OpenRouterService {
  const config = {
    get: vi.fn((key: string): string | undefined => env[key]),
  } as unknown as ConfigService;
  return new OpenRouterService(config);
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenRouterService.classifyFailure', () => {
  it('parses category + confidence and records the model used', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          choices: [
            { message: { content: '{"category":"external_api_failure","confidence":0.82}' } },
          ],
        }),
      ),
    );
    const svc = serviceWith({ OPENROUTER_API_KEY: 'test-key' });
    const result = await svc.classifyFailure(INPUT);
    expect(result?.category).toBe('external_api_failure');
    expect(result?.confidence).toBeCloseTo(0.82);
    expect(result?.model).toBe('openai/gpt-4o-mini');
    expect(result?.rawResponse).toBeDefined();
  });

  it('returns null without calling fetch when no API key is set', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const svc = serviceWith({ OPENROUTER_API_KEY: undefined });
    await expect(svc.classifyFailure(INPUT)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on unknown categories and non-JSON content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '{"category":"nope"}' } }] }),
      ),
    );
    const svc = serviceWith({ OPENROUTER_API_KEY: 'test-key' });
    await expect(svc.classifyFailure(INPUT)).rejects.toBeInstanceOf(
      OpenRouterError,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: 'not json at all' } }] }),
      ),
    );
    await expect(svc.classifyFailure(INPUT)).rejects.toBeInstanceOf(
      OpenRouterError,
    );
  });

  it('throws on transport and HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('socket hang up')),
    );
    const svc = serviceWith({ OPENROUTER_API_KEY: 'test-key' });
    await expect(svc.classifyFailure(INPUT)).rejects.toBeInstanceOf(
      OpenRouterError,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid key'),
      } as Response),
    );
    await expect(svc.classifyFailure(INPUT)).rejects.toBeInstanceOf(
      OpenRouterError,
    );
  });
});
