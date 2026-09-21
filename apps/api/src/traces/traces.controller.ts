import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { CreateFailureTagDto } from './dto/create-failure-tag.dto.js';
import { ListTracesDto } from './dto/list-traces.dto.js';
import { UpdateFailureTagDto } from './dto/update-failure-tag.dto.js';
import {
  FailureTagView,
  FailureTagsService,
} from './failure-tags.service.js';
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
  constructor(
    private readonly traces: TracesService,
    private readonly failureTags: FailureTagsService,
  ) {}

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

  @ProjectAccess('admin', 'developer')
  @Post('traces/:traceId/failure-tag')
  createFailureTag(
    @Param('traceId') traceId: string,
    @Body() dto: CreateFailureTagDto,
  ): Promise<FailureTagView> {
    return this.failureTags.create(traceId, dto);
  }

  @ProjectAccess('admin', 'developer')
  @Patch('traces/:traceId/failure-tag/:tagId')
  updateFailureTag(
    @Param('traceId') traceId: string,
    @Param('tagId') tagId: string,
    @Body() dto: UpdateFailureTagDto,
  ): Promise<FailureTagView> {
    return this.failureTags.update(traceId, tagId, dto);
  }
}
