import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TracesModule } from './traces/traces.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    // Single BullMQ connection for all queues.
    // from REDIS_URL so queue traffic follows the same endpoint as cache.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const parsed = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: parsed.hostname,
            port: parsed.port === '' ? 6379 : Number(parsed.port),
            // Mandatory for BullMQ workers (blocking connection).
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    AiModule,
    AuthModule,
    IngestionModule,
    OrganizationsModule,
    ProjectsModule,
    TracesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
