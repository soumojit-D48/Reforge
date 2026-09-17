import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { PROJECT_ACCESS_KEY } from '../decorators/project-access.decorator.js';
import type { OrgRoleName } from '../decorators/project-access.decorator.js';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles =
      this.reflector.getAllAndOverride<OrgRoleName[]>(PROJECT_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? null;
    if (allowedRoles === null) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: AuthenticatedUser } & Record<string, unknown>
      >();
    const user = request.user;
    if (user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    const params = request.params as Record<string, string | undefined>;
    const orgId = params['orgId'];
    const projectId = params['projectId'];

    if (projectId !== undefined) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      if (project === null) {
        throw new ForbiddenException('No access to this project');
      }
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: project.organizationId,
            userId: user.userId,
          },
        },
      });
      if (membership === null) {
        throw new ForbiddenException('No access to this project');
      }
      this.assertRole(membership.role, allowedRoles);
      return true;
    }

    if (orgId !== undefined) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: user.userId },
        },
      });
      if (membership === null) {
        throw new ForbiddenException('No access to this organization');
      }
      this.assertRole(membership.role, allowedRoles);
      return true;
    }

    throw new ForbiddenException('Project access could not be determined');
  }

  private assertRole(
    role: OrgRoleName,
    allowedRoles: OrgRoleName[],
  ): void {
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
  }
}
