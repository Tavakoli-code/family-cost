import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { FamilyRole, MemberStatus, RecordStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../constants/error-codes';
import { FamilyMemberGuard } from './family-member.guard';

const familyId = '11111111-1111-4111-8111-111111111111';
const otherFamilyId = '22222222-2222-4222-8222-222222222222';
const userId = 'authenticated-user';
const membership = {
  id: 'membership',
  familyId,
  userId,
  role: FamilyRole.VIEWER,
  family: { id: familyId, status: RecordStatus.ACTIVE },
};

function setup(routeFamilyId = familyId) {
  const request = {
    params: { familyId: routeFamilyId },
    user: { id: userId } as { id: string } | undefined,
    body: { familyId, userId: 'spoofed-user', role: FamilyRole.OWNER },
    familyMembership: undefined,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const prisma = { member: { findUnique: jest.fn() } };
  const guard = new FamilyMemberGuard(prisma as unknown as PrismaService);
  return { request, context, prisma, guard };
}

describe('FamilyMemberGuard', () => {
  it('attaches the verified membership using only the route and authenticated user', async () => {
    const { guard, context, request, prisma } = setup();
    prisma.member.findUnique.mockResolvedValue(membership);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.familyMembership).toBe(membership);
    expect(prisma.member.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.member.findUnique).toHaveBeenCalledWith({
      where: {
        familyId_userId: { familyId, userId },
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
  });

  it('returns unauthorized without a verified JWT user', async () => {
    const { guard, context, request, prisma } = setup();
    request.user = undefined;

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED,
    });
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a malformed route UUID before querying Prisma', async () => {
    const { guard, context, prisma } = setup('invalid');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.member.findUnique).not.toHaveBeenCalled();
  });

  it('returns the same 404 whenever no active membership in an active family matches', async () => {
    const { guard, context, request, prisma } = setup(otherFamilyId);
    prisma.member.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new NotFoundException('Family not found'),
    );
    expect(prisma.member.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId_userId: { familyId: otherFamilyId, userId },
        }),
      }),
    );
    expect(request.familyMembership).toBeUndefined();
  });
});
