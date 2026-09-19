import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getRequestLogContext } from './request-context.js';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

interface JsonLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  correlationId?: string;
  stack?: string;
  metadata?: unknown;
}

const SENSITIVE_KEY = /password|secret|token|authorization|api[-_]?key|cookie/i;

function safeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) {
    return value.map((item) => safeValue(item, seen));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : safeValue(nested, seen);
  }
  return result;
}

function messageText(message: unknown): string {
  if (message instanceof Error) {
    return message.message;
  }
  if (typeof message === 'string') {
    return message;
  }
  return JSON.stringify(safeValue(message));
}

@Injectable()
export class ReforgeLogger implements LoggerService {
  private readonly consoleLogger = new ConsoleLogger();
  private readonly logFilePath: string;

  constructor() {
    const logsDirectory = process.env['LOGS_DIR'] ?? join(process.cwd(), 'logs');
    this.logFilePath = join(resolve(logsDirectory), 'reforge.logs.jsonl');
    mkdirSync(resolve(logsDirectory), { recursive: true });
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, stack?: string, context?: string): void {
    this.write('fatal', message, context, stack);
  }

  setLogLevels(): void {
    // Nest calls this when log levels are configured; this logger writes all levels.
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    const text = messageText(message);
    if (level === 'error' || level === 'fatal') {
      this.consoleLogger.error(text, stack, context);
    } else if (level === 'warn') {
      this.consoleLogger.warn(text, context);
    } else if (level === 'debug') {
      this.consoleLogger.debug(text, context);
    } else if (level === 'verbose') {
      this.consoleLogger.verbose(text, context);
    } else {
      this.consoleLogger.log(text, context);
    }

    const requestContext = getRequestLogContext();
    const entry: JsonLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message: text,
      ...(context === undefined ? {} : { context }),
      ...(requestContext === undefined
        ? {}
        : { correlationId: requestContext.correlationId }),
      ...(stack === undefined ? {} : { stack }),
    };
    const serialized = `${JSON.stringify(entry)}\n`;
    try {
      appendFileSync(this.logFilePath, serialized, { encoding: 'utf8' });
    } catch (fileError) {
      // The primary console sink must remain available if disk logging fails.
      this.consoleLogger.error(
        `Failed to write JSONL log file: ${messageText(fileError)}`,
        undefined,
        ReforgeLogger.name,
      );
    }
  }
}
