import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SpanType, TraceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListTracesDto } from './dto/list-traces.dto.js';

const MAX_TRACE_LIST_LIMIT = 100;

interface TraceCursor {
  startedAt: string;
  id: string;
}

export interface TraceListItem {
  id: string;
  name: string;
  environment: string | null;
  status: TraceStatus;
  totalDurationMs: number | null;
  totalCost: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  models: string[];
  failureCategories: string[];
}

export interface TraceListResponse {
  items: TraceListItem[];
  nextCursor: string | null;
  limit: number;
}

export interface TraceSpanView {
  id: string;
  parentId: string | null;
  type: SpanType;
  name: string;
  model: string | null;
  promptVersion: string | null;
  input: unknown;
  output: unknown;
  arguments: unknown;
  result: unknown;
  error: unknown;
  tokenUsage: unknown;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  children: TraceSpanView[];
}

export interface TraceDetailView {
  id: string;
  projectId: string;
  externalId: string | null;
  name: string;
  environment: string | null;
  status: TraceStatus;
  input: unknown;
  metadata: unknown;
  totalDurationMs: number | null;
  totalCost: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  failureTags: {
    id: string;
    category: string;
    confidence: number | null;
    source: string;
    note: string | null;
    createdAt: string;
  }[];
  spans: TraceSpanView[];
}

function encodeCursor(cursor: TraceCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): TraceCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof (decoded as { startedAt?: unknown }).startedAt !== 'string' ||
      typeof (decoded as { id?: unknown }).id !== 'string'
    ) {
      throw new Error('invalid shape');
    }
    const date = new Date((decoded as TraceCursor).startedAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error('invalid date');
    }
    return decoded as TraceCursor;
  } catch {
    throw new BadRequestException('Invalid trace pagination cursor');
  }
}

function durationMs(startedAt: Date, endedAt: Date | null): number | null {
  return endedAt === null ? null : endedAt.getTime() - startedAt.getTime();
}

@Injectable()
export class TracesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: string, query: ListTracesDto): Promise<TraceListResponse> {
    const limit = Math.min(query.limit ?? 20, MAX_TRACE_LIST_LIMIT);
    const from = query.from === undefined ? undefined : new Date(query.from);
    const to = query.to === undefined ? undefined : new Date(query.to);
    if (from !== undefined && to !== undefined && from > to) {
      throw new BadRequestException('Trace date range is invalid: from must be before to');
    }
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor);
    const spanFilters: Prisma.TraceWhereInput[] = [];
    if (query.model !== undefined) {
      spanFilters.push({ spans: { some: { model: query.model } } });
    }
    if (query.errorType !== undefined) {
      spanFilters.push({ spans: { some: { type: query.errorType as SpanType } } });
    }
    const where: Prisma.TraceWhereInput = {
      projectId,
      status: query.status,
      environment: query.environment,
      startedAt: {
        gte: from,
        lte: to,
      },
      AND: spanFilters,
    };
    if (cursor !== null) {
      where.OR = [
        { startedAt: { lt: new Date(cursor.startedAt) } },
        { startedAt: new Date(cursor.startedAt), id: { lt: cursor.id } },
      ];
    }

    const traces = await this.prisma.trace.findMany({
      where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        spans: { select: { model: true } },
        failureTags: {
          select: { category: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const hasNextPage = traces.length > limit;
    const page = hasNextPage ? traces.slice(0, limit) : traces;
    const last = page.at(-1);

    return {
      items: page.map((trace) => ({
        id: trace.id,
        name: trace.name,
        environment: trace.environment,
        status: trace.status,
        totalDurationMs: trace.totalDurationMs,
        totalCost: trace.totalCost?.toString() ?? null,
        startedAt: trace.startedAt.toISOString(),
        endedAt: trace.endedAt?.toISOString() ?? null,
        createdAt: trace.createdAt.toISOString(),
        models: [...new Set(trace.spans.flatMap((span) => span.model === null ? [] : [span.model]))],
        failureCategories: [...new Set(trace.failureTags.map((tag) => tag.category))],
      })),
      nextCursor:
        hasNextPage && last !== undefined
          ? encodeCursor({ startedAt: last.startedAt.toISOString(), id: last.id })
          : null,
      limit,
    };
  }

  async getById(traceId: string): Promise<TraceDetailView> {
    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      include: {
        spans: { orderBy: [{ startedAt: 'asc' }, { id: 'asc' }] },
        failureTags: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (trace === null) {
      throw new NotFoundException('Trace not found');
    }

    const views: TraceSpanView[] = trace.spans.map((span) => ({
      id: span.id,
      parentId: span.parentId,
      type: span.type,
      name: span.name,
      model: span.model,
      promptVersion: span.promptVersion,
      input: span.input,
      output: span.output,
      arguments: span.arguments,
      result: span.result,
      error: span.error,
      tokenUsage: span.tokenUsage,
      startedAt: span.startedAt.toISOString(),
      endedAt: span.endedAt?.toISOString() ?? null,
      durationMs: durationMs(span.startedAt, span.endedAt),
      children: [],
    }));
    const byId = new Map(views.map((span) => [span.id, span]));
    const roots: TraceSpanView[] = [];
    for (const span of views) {
      const parent = span.parentId === null ? undefined : byId.get(span.parentId);
      if (parent === undefined) {
        roots.push(span);
      } else {
        parent.children.push(span);
      }
    }

    return {
      id: trace.id,
      projectId: trace.projectId,
      externalId: trace.externalId,
      name: trace.name,
      environment: trace.environment,
      status: trace.status,
      input: trace.input,
      metadata: trace.metadata,
      totalDurationMs: trace.totalDurationMs,
      totalCost: trace.totalCost?.toString() ?? null,
      startedAt: trace.startedAt.toISOString(),
      endedAt: trace.endedAt?.toISOString() ?? null,
      createdAt: trace.createdAt.toISOString(),
      failureTags: trace.failureTags.map((tag) => ({
        id: tag.id,
        category: tag.category,
        confidence: tag.confidence,
        source: tag.source,
        note: tag.note,
        createdAt: tag.createdAt.toISOString(),
      })),
      spans: roots,
    };
  }
}
