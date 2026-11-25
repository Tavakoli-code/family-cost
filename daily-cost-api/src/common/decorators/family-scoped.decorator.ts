import { UseGuards } from '@nestjs/common';
import { FamilyMemberGuard } from '../guards/family-member.guard';

// The global JWT guard authenticates the request before route guards run.
export const FamilyScoped = () => UseGuards(FamilyMemberGuard);
