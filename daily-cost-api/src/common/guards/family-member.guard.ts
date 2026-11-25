import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MemberStatus, RecordStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { unauthorized } from '../exceptions/auth-exceptions';
import type { FamilyScopedRequest } from '../types/family-membership-context.type';

@Injectable()
export class FamilyMemberGuard implements CanActivate {
  private readonly familyIdPipe = new ParseUUIDPipe();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FamilyScopedRequest>();
    if (!request.user) throw unauthorized();

    // Guards run before controller parameter pipes.
    const { familyId } = request.params;
    if (typeof familyId !== 'string') {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }
    await this.familyIdPipe.transform(familyId, {
      type: 'param',
      data: 'familyId',
    });
    const membership = await this.prisma.member.findUnique({
      where: {
        familyId_userId: { familyId, userId: request.user.id },
        status: MemberStatus.ACTIVE,
        family: { status: RecordStatus.ACTIVE },
      },
      select: {
        id: true,
        familyId: true,
        userId: true,
        role: true,
        family: true,
      },
    });

    if (!membership) throw new NotFoundException('Family not found');

    request.familyMembership = membership;
    return true;
  }
}
