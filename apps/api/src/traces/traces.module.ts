import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { TRACE_PROCESSING_QUEUE } from '../ingestion/ingestion.constants.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { TraceProcessingProcessor } from './trace-processing.processor.js';
import { TracesController } from './traces.controller.js';
import { TracesService } from './traces.service.js';
import { FailureTagsService } from './failure-tags.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRACE_PROCESSING_QUEUE }),
    AiModule,
    RealtimeModule,
  ],
  controllers: [TracesController],
  providers: [TraceProcessingProcessor, TracesService, FailureTagsService],
  exports: [TracesService],
})
export class TracesModule {}
