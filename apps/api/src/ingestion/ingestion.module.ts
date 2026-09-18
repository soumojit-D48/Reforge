import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TRACE_PROCESSING_QUEUE } from './ingestion.constants.js';
import { IngestionController } from './ingestion.controller.js';
import { IngestionService } from './ingestion.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: TRACE_PROCESSING_QUEUE })],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
