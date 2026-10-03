import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';

function parseOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return ['http://localhost:3000'];
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export class RedisIoAdapter extends IoAdapter implements OnApplicationShutdown {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  constructor(
    app: INestApplication,
    private readonly config: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.pubClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.subClient = this.pubClient.duplicate();
    await Promise.all([this.pubClient.ping(), this.subClient.ping()]);
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    if (this.adapterConstructor === null) {
      throw new Error('Redis Socket.IO adapter has not been initialized');
    }
    const socketOptions = {
      cors: {
        origin: parseOrigins(this.config.get<string>('WEB_ORIGINS')),
        credentials: true,
      },
    } as ServerOptions;
    if (options !== undefined) {
      Object.assign(socketOptions, options);
      socketOptions.cors = {
        origin: parseOrigins(this.config.get<string>('WEB_ORIGINS')),
        credentials: true,
      };
    }
    const server = super.createIOServer(port, socketOptions);
    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(): Promise<void> {
    await Promise.all([
      this.pubClient?.quit() ?? Promise.resolve('OK'),
      this.subClient?.quit() ?? Promise.resolve('OK'),
    ]);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
