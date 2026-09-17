import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const PASSWORD_SALT_ROUNDS = 10;

export interface AuthTokenResponse {
  accessToken: string;
  user: { id: string; email: string; name: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing !== null) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash, name: dto.name },
      });
      return this.signFor(user.id, user.email, user.name);
    } catch (err) {
      // Pre-check above races with concurrent registrations; the unique
      // constraint is the source of truth — map it to 409, rethrow the rest.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (user === null) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.signFor(user.id, user.email, user.name);
  }

  private signFor(
    userId: string,
    email: string,
    name: string,
  ): AuthTokenResponse {
    const expiresIn =
      (this.config.get<string>('JWT_EXPIRES_IN') ?? '7d') as JwtSignOptions['expiresIn'];
    const accessToken = this.jwt.sign(
      { sub: userId, email },
      { expiresIn },
    );
    return { accessToken, user: { id: userId, email, name } };
  }
}
