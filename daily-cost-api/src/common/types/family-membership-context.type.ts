import type { Family, Member } from '@prisma/client';
import type { AuthenticatedRequest } from './auth-request';

export type FamilyMembershipContext = Pick<
  Member,
  'id' | 'familyId' | 'userId' | 'role'
> & { family: Family };

export interface FamilyScopedRequest extends AuthenticatedRequest {
  familyMembership?: FamilyMembershipContext;
}
