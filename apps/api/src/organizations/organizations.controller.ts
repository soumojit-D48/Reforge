import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { ProjectAccessGuard } from '../common/guards/project-access.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator.js';
import { ProjectAccess } from '../common/decorators/project-access.decorator.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('orgs')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<{ id: string; name: string; role: string }> {
    return this.orgs.create(user.userId, dto.name);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<
    { id: string; name: string; role: string }[]
  > {
    return this.orgs.listForUser(user.userId);
  }

  @ProjectAccess()
  @Get(':orgId/members')
  listMembers(@Param('orgId') orgId: string): Promise<
    { userId: string; email: string; role: string }[]
  > {
    return this.orgs.listMembers(orgId);
  }

  @ProjectAccess('admin')
  @Post(':orgId/members')
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orgId') orgId: string,
    @Body() dto: AddMemberDto,
  ): Promise<{ userId: string; role: string }> {
    return this.orgs.addMember(user.userId, orgId, dto.email, dto.role);
  }
}
