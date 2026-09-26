import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ListReviewQueueDto } from './dto/list-review-queue.dto.js';
import { SubmitAnnotationDto } from './dto/submit-annotation.dto.js';
import {
  AnnotationsService,
  type ReviewDetail,
  type ReviewQueueItem,
} from './annotations.service.js';

@ApiTags('annotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller()
export class AnnotationsController {
  constructor(private readonly annotations: AnnotationsService) {}

  @ProjectAccess()
  @Get('projects/:projectId/annotations/queue')
  listQueue(
    @Param('projectId') projectId: string,
    @Query() _query: ListReviewQueueDto,
  ): Promise<ReviewQueueItem[]> {
    return this.annotations.listQueue(projectId);
  }

  @ProjectAccess()
  @Get('projects/:projectId/annotations/:annotationId')
  getDetail(
    @Param('projectId') projectId: string,
    @Param('annotationId') annotationId: string,
  ): Promise<ReviewDetail> {
    return this.annotations.getDetail(projectId, annotationId);
  }

  @ProjectAccess('admin', 'developer', 'reviewer')
  @Patch('projects/:projectId/annotations/:annotationId')
  submit(
    @Param('projectId') projectId: string,
    @Param('annotationId') annotationId: string,
    @Body() dto: SubmitAnnotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewDetail> {
    return this.annotations.submit(
      projectId,
      annotationId,
      user.userId,
      dto.verdict,
      dto.note,
    );
  }
}
