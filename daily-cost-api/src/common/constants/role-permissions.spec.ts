import { FamilyRole } from '@prisma/client';
import { Permission } from './permissions';
import { hasPermission, ROLE_PERMISSIONS } from './role-permissions';

const capabilities: [Permission, ...FamilyRole[]][] = [
  [Permission.FAMILY_VIEW, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  [Permission.FAMILY_UPDATE, 'OWNER'],
  [Permission.FAMILY_ARCHIVE, 'OWNER'],
  [Permission.FAMILY_MANAGE_MEMBERS, 'OWNER', 'ADMIN'],
  [Permission.FAMILY_MANAGE_ROLES, 'OWNER'],
  [Permission.WALLET_VIEW, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  [Permission.WALLET_MANAGE, 'OWNER', 'ADMIN'],
  [Permission.CATEGORY_VIEW, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  [Permission.CATEGORY_MANAGE, 'OWNER', 'ADMIN'],
  [Permission.TRANSACTION_VIEW, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  [Permission.TRANSACTION_CREATE, 'OWNER', 'ADMIN', 'MEMBER'],
  [Permission.TRANSACTION_UPDATE_OWN, 'OWNER', 'ADMIN', 'MEMBER'],
  [Permission.TRANSACTION_UPDATE_ANY, 'OWNER', 'ADMIN'],
  [Permission.TRANSACTION_DELETE_OWN, 'OWNER', 'ADMIN', 'MEMBER'],
  [Permission.TRANSACTION_DELETE_ANY, 'OWNER', 'ADMIN'],
  [Permission.REPORT_VIEW, 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
];

describe('Role permission matrix', () => {
  it('covers all four roles and every defined permission', () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      Object.values(FamilyRole).sort(),
    );
    expect(capabilities.map(([permission]) => permission).sort()).toEqual(
      Object.values(Permission).sort(),
    );
    expect(Object.isFrozen(ROLE_PERMISSIONS)).toBe(true);
    expect(Object.values(ROLE_PERMISSIONS).every(Object.isFrozen)).toBe(true);
  });

  it.each(capabilities)(
    'grants %s only to the expected roles',
    (permission, ...allowedRoles) => {
      for (const role of Object.values(FamilyRole)) {
        expect(hasPermission(role, permission)).toBe(
          allowedRoles.includes(role),
        );
      }
    },
  );

  it('denies unknown permissions and roles', () => {
    expect(hasPermission(FamilyRole.OWNER, 'UNKNOWN' as Permission)).toBe(
      false,
    );
    expect(
      hasPermission('constructor' as FamilyRole, Permission.FAMILY_VIEW),
    ).toBe(false);
  });
});
