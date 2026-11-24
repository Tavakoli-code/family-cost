import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { unauthorized } from '../exceptions/auth-exceptions';
import { AuthenticatedRequest, AuthUser } from '../types/auth-request';

export function extractCurrentUser(
  field: keyof AuthUser | undefined,
  context: ExecutionContext,
): AuthUser | string {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw unauthorized();
  return field ? user[field] : user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);