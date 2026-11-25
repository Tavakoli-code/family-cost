import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../constants/permissions';

export const REQUIRED_PERMISSIONS_KEY = 'requiredFamilyPermissions';

/** All listed permissions are required. Controller and method requirements are cumulative. */
export const RequirePermissions = (
  permission: Permission,
  ...additional: Permission[]
) => SetMetadata(REQUIRED_PERMISSIONS_KEY, [permission, ...additional]);
