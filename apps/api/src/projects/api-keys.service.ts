import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GeneratedApiKey {
  id: string;
  publicKey: string;
  /** Full credential for the `x-api-key` header (`publicKey.secret`).
   *  The secret half is shown exactly once — only the hash is stored. */
  key: string;
  status: string;
  createdAt: Date;
}

export interface ApiKeyView {
  id: string;
  publicKey: string;
  status: string;
  createdAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generate(
    projectId: string,
    db: Pick<PrismaClient, 'apiKey'> = this.prisma,
  ): Promise<GeneratedApiKey> {
    // ConfigModule exposes env values as strings; coerce defensively since
    // bcrypt rejects non-numeric rounds with an "Invalid salt" error.
    const rawRounds = this.config.get<string>('API_KEY_HASH_SALT_ROUNDS');
    const parsed = rawRounds === undefined ? NaN : Number(rawRounds);
    const saltRounds = Number.isInteger(parsed) ? parsed : 10;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const publicKey = `pk_live_${randomBytes(12).toString('hex')}`;
      const secret = randomBytes(32).toString('hex');
      const secretKeyHash = await bcrypt.hash(secret, saltRounds);
      try {
        const created = await db.apiKey.create({
          data: { projectId, publicKey, secretKeyHash },
        });
        return {
          id: created.id,
          publicKey: created.publicKey,
          key: `${publicKey}.${secret}`,
          status: created.status,
          createdAt: created.createdAt,
        };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate a unique API key');
  }

  async list(projectId: string): Promise<ApiKeyView[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    return keys.map((k) => ({
      id: k.id,
      publicKey: k.publicKey,
      status: k.status,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt,
    }));
  }

  async revoke(projectId: string, keyId: string): Promise<ApiKeyView> {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, projectId },
    });
    if (existing === null) {
      throw new NotFoundException('API key not found');
    }
    if (existing.status === 'revoked') {
      return {
        id: existing.id,
        publicKey: existing.publicKey,
        status: existing.status,
        createdAt: existing.createdAt,
        revokedAt: existing.revokedAt,
      };
    }
    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { status: 'revoked', revokedAt: new Date() },
    });
    return {
      id: updated.id,
      publicKey: updated.publicKey,
      status: updated.status,
      createdAt: updated.createdAt,
      revokedAt: updated.revokedAt,
    };
  }
}
