import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { CreateEvaluationDto } from './dto/create-evaluation.dto.js';
import { UpdateEvaluationOverrideDto } from './dto/update-evaluation-override.dto.js';
import { ListEvaluationsDto } from './dto/list-evaluations.dto.js';
import { EvaluationsService, type EvaluationView } from './evaluations.service.js';

@ApiTags('evaluations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller()
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @ProjectAccess('admin', 'developer')
  @Post('evaluations')
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreateEvaluationDto): Promise<EvaluationView> {
    return this.evaluations.create(dto);
  }

  @ProjectAccess()
  @Get('evaluations')
  list(@Query() query: ListEvaluationsDto): Promise<EvaluationView[]> {
    return this.evaluations.list(query.targetType, query.targetId);
  }

  @ProjectAccess()
  @Get('evaluations/:evaluationId')
  get(@Param('evaluationId') evaluationId: string): Promise<EvaluationView> {
    return this.evaluations.getById(evaluationId);
  }

  @ProjectAccess('admin', 'developer')
  @Patch('evaluations/:evaluationId/override')
  override(
    @Param('evaluationId') evaluationId: string,
    @Body() dto: UpdateEvaluationOverrideDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EvaluationView> {
    return this.evaluations.override(evaluationId, user.userId, dto.score, dto.reason);
  }
}
