import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ApiKeysService],
  exports: [ProjectsService, ApiKeysService],
})
export class ProjectsModule {}
