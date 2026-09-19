import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { ListTracesDto } from './dto/list-traces.dto.js';
import {
  TraceDetailView,
  TraceListResponse,
  TracesService,
} from './traces.service.js';

@ApiTags('traces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller()
export class TracesController {
  constructor(private readonly traces: TracesService) {}

  @ProjectAccess()
  @Get('projects/:projectId/traces')
  list(
    @Param('projectId') projectId: string,
    @Query() query: ListTracesDto,
  ): Promise<TraceListResponse> {
    return this.traces.list(projectId, query);
  }

  @ProjectAccess()
  @Get('traces/:traceId')
  get(@Param('traceId') traceId: string): Promise<TraceDetailView> {
    return this.traces.getById(traceId);
  }
}
