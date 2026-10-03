import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EvaluationsModule } from '../evaluations/evaluations.module.js';
import { ReplayModule } from '../replay/replay.module.js';
import { TEST_RUN_QUEUE } from './regression.constants.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { RegressionController } from './regression.controller.js';
import { RegressionService } from './regression.service.js';
import { TestRunProcessor } from './test-run.processor.js';

@Module({
  imports: [
    EvaluationsModule,
    ReplayModule,
    RealtimeModule,
    BullModule.registerQueue({ name: TEST_RUN_QUEUE }),
  ],
  controllers: [RegressionController],
  providers: [RegressionService, TestRunProcessor],
  exports: [RegressionService],
})
export class RegressionModule {}
