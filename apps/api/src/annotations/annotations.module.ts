import { Module } from '@nestjs/common';
import { AnnotationsController } from './annotations.controller.js';
import { AnnotationsService } from './annotations.service.js';

@Module({
  controllers: [AnnotationsController],
  providers: [AnnotationsService],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
