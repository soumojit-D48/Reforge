import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  @ProjectAccess('admin', 'developer')
  @Post('orgs/:orgId/projects')
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<{
    project: { id: string; organizationId: string; name: string };
    apiKey: { id: string; publicKey: string; key: string };
  }> {
    return this.projects.create(orgId, dto.name);
  }

  @ProjectAccess()
  @Get('orgs/:orgId/projects')
  list(@Param('orgId') orgId: string): Promise<
    { id: string; organizationId: string; name: string }[]
  > {
    return this.projects.list(orgId);
  }

  @ProjectAccess('admin', 'developer')
  @Post('projects/:projectId/api-keys')
  generateKey(@Param('projectId') projectId: string): Promise<{
    id: string;
    publicKey: string;
    key: string;
  }> {
    return this.apiKeys.generate(projectId);
  }

  @ProjectAccess()
  @Get('projects/:projectId/api-keys')
  listKeys(@Param('projectId') projectId: string): Promise<
    { id: string; publicKey: string; status: string }[]
  > {
    return this.apiKeys.list(projectId);
  }

  @ProjectAccess('admin')
  @Delete('projects/:projectId/api-keys/:keyId')
  revokeKey(
    @Param('projectId') projectId: string,
    @Param('keyId') keyId: string,
  ): Promise<{ id: string; status: string }> {
    return this.apiKeys.revoke(projectId, keyId);
  }
}
