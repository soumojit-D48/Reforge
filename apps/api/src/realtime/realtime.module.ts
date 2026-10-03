import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RealtimeService } from './realtime.service.js';
import { RunsGateway } from './runs.gateway.js';

@Global()
@Module({
  imports: [JwtModule.register({}), PrismaModule],
  providers: [RealtimeService, RunsGateway],
  exports: [RealtimeService],
})
export class RealtimeModule {}
