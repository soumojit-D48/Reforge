import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApiKeysService, type GeneratedApiKey } from './api-keys.service.js';

export interface ProjectView {
  id: string;
  organizationId: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async create(
    orgId: string,
    name: string,
  ): Promise<{ project: ProjectView; apiKey: GeneratedApiKey }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (org === null) {
      throw new NotFoundException('Organization not found');
    }
    // Project + initial key (FR-4) are created atomically: if key
    // generation fails the project row rolls back instead of orphaning.
    // And tx is a Prisma client object used to perform database operations inside a transaction.
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { organizationId: orgId, name },
      });
      const apiKey = await this.apiKeys.generate(project.id, tx);
      return {
        project: {
          id: project.id,
          organizationId: project.organizationId,
          name: project.name,
          createdAt: project.createdAt,
        },
        apiKey,
      };
    });
  }

  async list(orgId: string): Promise<ProjectView[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (org === null) {
      throw new NotFoundException('Organization not found');
    }
    const projects = await this.prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    return projects.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      createdAt: p.createdAt,
    }));
  }
}
