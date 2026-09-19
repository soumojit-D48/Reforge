import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runWithRequestContext } from './request-context.js';
import { ReforgeLogger } from './reforge-logger.js';

describe('ReforgeLogger', () => {
  let logsDirectory: string;

  afterEach(() => {
    rmSync(logsDirectory, { recursive: true, force: true });
    delete process.env['LOGS_DIR'];
  });

  it('writes JSONL entries and preserves the request correlation id', () => {
    logsDirectory = mkdtempSync(join(tmpdir(), 'reforge-logger-'));
    process.env['LOGS_DIR'] = logsDirectory;
    const logger = new ReforgeLogger();
    runWithRequestContext({ correlationId: 'request-123' }, () => {
      logger.log({ event: 'login', accessToken: 'do-not-write' }, 'AuthService');
    });

    const line = readFileSync(join(logsDirectory, 'reforge.logs.jsonl'), 'utf8').trim();
    const entry = JSON.parse(line) as {
      level: string;
      context: string;
      correlationId: string;
      message: string;
    };
    expect(entry.level).toBe('log');
    expect(entry.context).toBe('AuthService');
    expect(entry.correlationId).toBe('request-123');
    expect(entry.message).toContain('[REDACTED]');
    expect(entry.message).not.toContain('do-not-write');
  });

  it('writes error stack traces without failing the application logger', () => {
    logsDirectory = mkdtempSync(join(tmpdir(), 'reforge-logger-'));
    process.env['LOGS_DIR'] = logsDirectory;
    const logger = new ReforgeLogger();

    logger.error('database unavailable', 'Error: database unavailable\n at test', 'PrismaService');

    const entry = JSON.parse(
      readFileSync(join(logsDirectory, 'reforge.logs.jsonl'), 'utf8').trim(),
    ) as { level: string; stack?: string };
    expect(entry.level).toBe('error');
    expect(entry.stack).toContain('database unavailable');
  });
});
