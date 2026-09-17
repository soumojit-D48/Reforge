import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrgRoleName } from '../common/decorators/project-access.decorator.js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface OrganizationView {
  id: string;
  name: string;
  role: OrgRoleName;
}

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string): Promise<OrganizationView> {
    const org = await this.prisma.organization.create({
      data: {
        name,
        members: { create: { userId, role: 'admin' } },
      },
    });
    return { id: org.id, name: org.name, role: 'admin' };
  }

  async listForUser(userId: string): Promise<OrganizationView[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { organization: { createdAt: 'asc' } },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role as OrgRoleName,
    }));
  }

  async addMember(
    callerUserId: string,
    orgId: string,
    email: string,
    role: OrgRoleName,
  ): Promise<{ userId: string; role: OrgRoleName }> {
    const caller = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: callerUserId },
      },
    });
    if (caller === null || caller.role !== 'admin') {
      throw new ForbiddenException('Only org admins can invite members');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user === null) {
      throw new NotFoundException('No user registered with that email');
    }
    try {
      const created = await this.prisma.organizationMember.create({
        data: { organizationId: orgId, userId: user.id, role },
      });
      return { userId: created.userId, role: created.role as OrgRoleName };
    } catch (err) {
      // Only the duplicate-membership conflict maps to 409 — anything else
      // (connection loss, etc.) must surface, not masquerade as a conflict.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('User is already a member of this org');
      }
      throw err;
    }
  }

  async listMembers(
    orgId: string,
  ): Promise<{ userId: string; email: string; role: OrgRoleName }[]> {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, email: true } } },
    });
    return members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      role: m.role as OrgRoleName,
    }));
  }
}
