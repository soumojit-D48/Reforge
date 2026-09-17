import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OrganizationsService } from './organizations.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function serviceWith(prisma: unknown): OrganizationsService {
  return new OrganizationsService(prisma as unknown as PrismaService);
}

describe('OrganizationsService.addMember', () => {
  it('rejects when the caller is not an admin', async () => {
    const svc = serviceWith({
      organizationMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'developer' }),
      },
    });
    await expect(
      svc.addMember('caller', 'org1', 'x@example.com', 'developer'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unknown emails with 404', async () => {
    const svc = serviceWith({
      organizationMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'admin' }),
      },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      svc.addMember('caller', 'org1', 'ghost@example.com', 'reviewer'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate membership (P2002) to 409', async () => {
    const svc = serviceWith({
      organizationMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'admin' }),
        create: vi
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('dup', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          ),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u2' }) },
    });
    await expect(
      svc.addMember('caller', 'org1', 'dup@example.com', 'developer'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows unexpected persistence errors instead of masking as 409', async () => {
    const svc = serviceWith({
      organizationMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'admin' }),
        create: vi.fn().mockRejectedValue(new Error('db down')),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u2' }) },
    });
    await expect(
      svc.addMember('caller', 'org1', 'x@example.com', 'developer'),
    ).rejects.toThrow('db down');
  });
});
