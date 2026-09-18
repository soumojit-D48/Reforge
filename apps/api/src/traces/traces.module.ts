import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module.js';
import { TRACE_PROCESSING_QUEUE } from '../ingestion/ingestion.constants.js';
import { TraceProcessingProcessor } from './trace-processing.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: TRACE_PROCESSING_QUEUE }), AiModule],
  providers: [TraceProcessingProcessor],
})
export class TracesModule {}
