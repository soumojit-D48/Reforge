import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { EVALUATION_QUEUE } from './evaluation.constants.js';
import { EvaluationProcessor } from './evaluation.processor.js';
import { EvaluationsController } from './evaluations.controller.js';
import { EvaluationsService } from './evaluations.service.js';

@Module({
  imports: [AiModule, BullModule.registerQueue({ name: EVALUATION_QUEUE })],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, EvaluationProcessor],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
