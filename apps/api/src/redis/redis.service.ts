import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  get raw(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  /**
   * Fixed-window rate limit counter.
   * Returns the current window count AFTER incrementing; callers compare
   * against their configured max. First hit in a window sets the expiry.
   */
  async incrementRateLimit(
    projectId: string,
    windowSeconds = 60,
  ): Promise<number> {
    const key = `ratelimit:${projectId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return count;
  }

  /** Idempotency fast path (FR-11): stored trace id or null on first sight. */
  async getIdempotencyRecord(
    projectId: string,
    externalId: string,
  ): Promise<string | null> {
    return this.client.get(`idem:${projectId}:${externalId}`);
  }

  async setIdempotencyRecord(
    projectId: string,
    externalId: string,
    traceId: string,
    ttlSeconds = 24 * 60 * 60,
  ): Promise<void> {
    await this.client.set(
      `idem:${projectId}:${externalId}`,
      traceId,
      'EX',
      ttlSeconds,
    );
  }

  async acquireReplayLock(
    traceId: string,
    owner: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(
      `replaylock:${traceId}`,
      owner,
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async releaseReplayLock(traceId: string, owner: string): Promise<void> {
    await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      `replaylock:${traceId}`,
      owner,
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.client.disconnect();
    } catch (err) {
      this.logger.warn(
        `Error disconnecting Redis client: ${(err as Error).message}`,
      );
    }
  }
}
