import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FamilyRole } from '@prisma/client';
import { Permission } from '../constants/permissions';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

class MethodRoutes {
  open() {}

  @RequirePermissions(Permission.FAMILY_VIEW, Permission.REPORT_VIEW)
  read() {}

  @RequirePermissions(Permission.FAMILY_VIEW, Permission.FAMILY_UPDATE)
  update() {}
}

@RequirePermissions(Permission.WALLET_MANAGE)
class ControllerRoutes {
  manage() {}

  @RequirePermissions(Permission.FAMILY_VIEW)
  read() {}

  @RequirePermissions(Permission.FAMILY_ARCHIVE)
  archive() {}
}

function context(controller: Function, handler: Function, role?: FamilyRole) {
  return {
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        body: {
          role: FamilyRole.OWNER,
          permissions: Object.values(Permission),
        },
        user: { id: 'current-user', role: FamilyRole.OWNER },
        familyMembership: role ? { role } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows routes without required permissions', () => {
    expect(
      guard.canActivate(context(MethodRoutes, MethodRoutes.prototype.open)),
    ).toBe(true);
  });

  it('allows a member with every permission declared on a method', () => {
    expect(
      guard.canActivate(
        context(MethodRoutes, MethodRoutes.prototype.read, FamilyRole.VIEWER),
      ),
    ).toBe(true);
  });

  it('requires every method permission and ignores roles supplied outside the membership', () => {
    expect(() =>
      guard.canActivate(
        context(MethodRoutes, MethodRoutes.prototype.update, FamilyRole.ADMIN),
      ),
    ).toThrow(new ForbiddenException('Insufficient permissions'));
  });

  it('fails closed when the verified membership is missing', () => {
    expect(() =>
      guard.canActivate(context(MethodRoutes, MethodRoutes.prototype.read)),
    ).toThrow(ForbiddenException);
  });

  it('enforces controller permissions on methods with no metadata of their own', () => {
    expect(
      guard.canActivate(
        context(
          ControllerRoutes,
          ControllerRoutes.prototype.manage,
          FamilyRole.ADMIN,
        ),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context(
          ControllerRoutes,
          ControllerRoutes.prototype.manage,
          FamilyRole.MEMBER,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires both controller and method permissions', () => {
    expect(() =>
      guard.canActivate(
        context(
          ControllerRoutes,
          ControllerRoutes.prototype.read,
          FamilyRole.MEMBER,
        ),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(
        context(
          ControllerRoutes,
          ControllerRoutes.prototype.archive,
          FamilyRole.ADMIN,
        ),
      ),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        context(
          ControllerRoutes,
          ControllerRoutes.prototype.archive,
          FamilyRole.OWNER,
        ),
      ),
    ).toBe(true);
  });
});
