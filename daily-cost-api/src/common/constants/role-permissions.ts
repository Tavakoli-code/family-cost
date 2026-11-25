import { FamilyRole } from '@prisma/client';
import { Permission } from './permissions';

const viewerPermissions = Object.freeze([
  Permission.FAMILY_VIEW,
  Permission.WALLET_VIEW,
  Permission.CATEGORY_VIEW,
  Permission.TRANSACTION_VIEW,
  Permission.REPORT_VIEW,
]);

const memberPermissions = Object.freeze([
  ...viewerPermissions,
  Permission.TRANSACTION_CREATE,
  Permission.TRANSACTION_UPDATE_OWN,
  Permission.TRANSACTION_DELETE_OWN,
]);

const adminPermissions = Object.freeze([
  ...memberPermissions,
  Permission.FAMILY_MANAGE_MEMBERS,
  Permission.WALLET_MANAGE,
  Permission.CATEGORY_MANAGE,
  Permission.TRANSACTION_UPDATE_ANY,
  Permission.TRANSACTION_DELETE_ANY,
]);

export const ROLE_PERMISSIONS: Readonly<
  Record<FamilyRole, readonly Permission[]>
> = Object.freeze({
  [FamilyRole.OWNER]: Object.freeze([
    ...adminPermissions,
    Permission.FAMILY_UPDATE,
    Permission.FAMILY_ARCHIVE,
    Permission.FAMILY_MANAGE_ROLES,
  ]),
  [FamilyRole.ADMIN]: adminPermissions,
  [FamilyRole.MEMBER]: memberPermissions,
  [FamilyRole.VIEWER]: viewerPermissions,
});

export function hasPermission(
  role: FamilyRole,
  permission: Permission,
): boolean {
  return (
    Object.hasOwn(ROLE_PERMISSIONS, role) &&
    ROLE_PERMISSIONS[role].includes(permission)
  );
}
