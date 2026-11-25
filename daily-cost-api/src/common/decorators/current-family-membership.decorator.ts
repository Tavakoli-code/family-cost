import {
  createParamDecorator,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import type {
  FamilyMembershipContext,
  FamilyScopedRequest,
} from '../types/family-membership-context.type';

export const CurrentFamilyMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): FamilyMembershipContext => {
    const { familyMembership } = context
      .switchToHttp()
      .getRequest<FamilyScopedRequest>();
    if (!familyMembership) throw new NotFoundException('Family not found');

    return familyMembership;
  },
);
