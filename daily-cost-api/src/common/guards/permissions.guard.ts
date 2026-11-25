import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '../constants/permissions';
import { hasPermission } from '../constants/role-permissions';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { FamilyScopedRequest } from '../types/family-membership-context.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.getAllAndMerge<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getClass(), context.getHandler()],
    );
    if (!permissions.length) return true;

    const { familyMembership } = context
      .switchToHttp()
      .getRequest<FamilyScopedRequest>();
    if (
      !familyMembership ||
      !permissions.every((permission) =>
        hasPermission(familyMembership.role, permission),
      )
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
