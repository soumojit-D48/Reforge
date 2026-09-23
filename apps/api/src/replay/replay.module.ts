import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import {
  REPLAY_EXECUTION_QUEUE,
} from './replay.constants.js';
import { ReplayController } from './replay.controller.js';
import { ReplayExecutionProcessor } from './replay-execution.processor.js';
import { ReplayService } from './replay.service.js';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({ name: REPLAY_EXECUTION_QUEUE }),
  ],
  controllers: [ReplayController],
  providers: [ReplayService, ReplayExecutionProcessor],
  exports: [ReplayService],
})
export class ReplayModule {}
