import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Explicit no-arg constructor: the v12 AuthGuard mixin declares an
  // `@Optional() @Inject(AuthModuleOptions)` constructor param that cannot
  // be resolved in feature modules (PassportModule is never registered with
  // options). Declaring our own constructor keeps DI dependency-free.
  constructor() {
    super();
  }
  // Signature mirrors the passport base guard (generic TUser plus trailing
  // passport args); the body narrows to "authenticated user or 401".
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ..._info: unknown[]
  ): TUser {
    if (err !== null && err !== undefined) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }
    if (user === false || user === null || user === undefined) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
