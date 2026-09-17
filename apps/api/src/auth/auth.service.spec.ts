import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function knownRequestError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeService(prisma: unknown): AuthService {
  const jwt = { sign: vi.fn().mockReturnValue('signed-token') } as unknown as JwtService;
  const config = {
    get: vi.fn().mockReturnValue('7d'),
  } as unknown as ConfigService;
  return new AuthService(prisma as unknown as PrismaService, jwt, config);
}

describe('AuthService', () => {
  it('register maps a concurrent-duplicate race (P2002) to 409', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(knownRequestError()),
      },
    };
    const service = makeService(prisma);
    await expect(
      service.register({
        email: 'race@example.com',
        password: 'password123',
        name: 'Race',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('register rethrows non-conflict persistence errors', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new Error('db down')),
      },
    };
    const service = makeService(prisma);
    await expect(
      service.register({
        email: 'x@example.com',
        password: 'password123',
        name: 'X',
      }),
    ).rejects.toThrow('db down');
  });

  it('login succeeds with correct password and fails with wrong one', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'u1', email: 'u@example.com', name: 'U', passwordHash }),
      },
    };
    const service = makeService(prisma);

    const ok = await service.login({
      email: 'u@example.com',
      password: 'password123',
    });
    expect(ok.accessToken).toBe('signed-token');
    expect(ok.user.id).toBe('u1');

    await expect(
      service.login({ email: 'u@example.com', password: 'wrongpass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login with unknown email is 401 without revealing existence', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = makeService(prisma);
    const err = await service
      .login({ email: 'nobody@example.com', password: 'password123' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect((err as UnauthorizedException).message).toBe('Invalid credentials');
  });
});
