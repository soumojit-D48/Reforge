import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FailureCategory } from '@prisma/client';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_CLASSIFY_MODEL = 'openai/gpt-4o-mini';

const FAILURE_CATEGORIES = Object.values(FailureCategory) as string[];

export interface FailureClassification {
  category: FailureCategory;
  confidence: number;
  model: string;
  rawResponse: unknown;
}

export interface ClassifyInput {
  traceName: string;
  status: string;
  spanSummaries: string[];
  errorExcerpts: string[];
}

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  constructor(private readonly config: ConfigService) {}

  private apiKey(): string | null {
    const key = this.config.get<string>('OPENROUTER_API_KEY');
    return key === undefined || key.trim() === '' ? null : key;
  }

  async classifyFailure(
    input: ClassifyInput,
  ): Promise<FailureClassification | null> {
    const key = this.apiKey();
    if (key === null) {
      // No key configured (local dev, CI): skip AI tagging loudly in logs
      // but quietly in control flow — processing must succeed regardless.
      this.logger.warn(
        'OPENROUTER_API_KEY not set — skipping AI failure classification',
      );
      return null;
    }
    const model =
      this.config.get<string>('OPENROUTER_CLASSIFY_MODEL') ??
      DEFAULT_CLASSIFY_MODEL;

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You classify why an AI agent run failed. Reply with JSON only: {"category": "<one of: ' +
                FAILURE_CATEGORIES.join(', ') +
                '>", "confidence": <0..1>}.',
            },
            {
              role: 'user',
              content: [
                `Trace: ${input.traceName} (status: ${input.status})`,
                `Spans: ${input.spanSummaries.join(' | ')}`,
                `Errors: ${input.errorExcerpts.join(' | ')}`,
              ].join('\n'),
            },
          ],
        }),
      });
    } catch (err) {
      throw new OpenRouterError(
        `OpenRouter request failed: ${(err as Error).message}`,
      );
    }
    if (!response.ok) {
      throw new OpenRouterError(
        `OpenRouter responded ${response.status}: ${await response.text()}`,
      );
    }

    const parsed = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = parsed.choices?.[0]?.message?.content ?? '';
    const classification = this.parseClassification(content);
    return { ...classification, model, rawResponse: parsed };
  }

  private parseClassification(
    content: string,
  ): Pick<FailureClassification, 'category' | 'confidence'> {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new OpenRouterError('OpenRouter returned non-JSON content');
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(content.slice(start, end + 1)) as unknown;
    } catch {
      throw new OpenRouterError('OpenRouter returned malformed JSON');
    }
    if (typeof decoded !== 'object' || decoded === null) {
      throw new OpenRouterError('OpenRouter returned a non-object payload');
    }
    const record = decoded as Record<string, unknown>;
    if (
      typeof record['category'] !== 'string' ||
      !FAILURE_CATEGORIES.includes(record['category'])
    ) {
      throw new OpenRouterError(
        `OpenRouter returned unknown category: ${String(record['category'])}`,
      );
    }
    const confidence =
      typeof record['confidence'] === 'number' ? record['confidence'] : 0.5;
    return {
      category: record['category'] as FailureCategory,
      confidence: Math.min(1, Math.max(0, confidence)),
    };
  }
}
