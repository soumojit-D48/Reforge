import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface ApiKeyRequestContext {
  projectId: string;
  apiKeyId: string;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { apiKey?: ApiKeyRequestContext }>();

    const header = request.headers['x-api-key'];
    const presented = Array.isArray(header) ? header[0] : header;
    if (presented === undefined || presented.length === 0) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    const separatorIndex = presented.lastIndexOf('.');
    if (separatorIndex <= 0) {
      throw new UnauthorizedException('Malformed API key');
    }
    const publicKey = presented.slice(0, separatorIndex);
    const secret = presented.slice(separatorIndex + 1);

    const stored = await this.prisma.apiKey.findUnique({
      where: { publicKey },
    });
    if (stored === null || stored.status !== 'active') {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    let matches = false;
    try {
      matches = await bcrypt.compare(secret, stored.secretKeyHash);
    } catch {
      matches = false;
    }
    if (!matches) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.apiKey = { projectId: stored.projectId, apiKeyId: stored.id };
    return true;
  }
}
