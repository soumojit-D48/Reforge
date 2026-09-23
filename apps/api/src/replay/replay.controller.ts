import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { CreateReplayDto } from './dto/create-replay.dto.js';
import { UpdateReplayOutcomeDto } from './dto/update-replay-outcome.dto.js';
import { ReplayService, type ReplayView } from './replay.service.js';

@ApiTags('replays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller()
export class ReplayController {
  constructor(private readonly replays: ReplayService) {}

  @ProjectAccess('admin', 'developer')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('traces/:traceId/replay')
  create(
    @Param('traceId') traceId: string,
    @Body() dto: CreateReplayDto,
  ): Promise<ReplayView> {
    return this.replays.create(traceId, dto);
  }

  @ProjectAccess()
  @Get('replays/:replayId')
  get(@Param('replayId') replayId: string): Promise<ReplayView> {
    return this.replays.getById(replayId);
  }

  @ProjectAccess()
  @Get('replays/:replayId/compare')
  compare(@Param('replayId') replayId: string) {
    return this.replays.compare(replayId);
  }

  @ProjectAccess('admin', 'developer')
  @Patch('replays/:replayId/outcome')
  updateOutcome(
    @Param('replayId') replayId: string,
    @Body() dto: UpdateReplayOutcomeDto,
  ): Promise<ReplayView> {
    return this.replays.updateOutcome(replayId, dto.outcome);
  }
}
