import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { tokenExpired, unauthorized } from '../exceptions/auth-exceptions';
import { AuthUser } from '../types/auth-request';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (err) throw err;
    if (!user) {
      if (info instanceof Error && info.name === 'TokenExpiredError') {
        throw tokenExpired();
      }
      throw unauthorized();
    }
    return user;
  }
}