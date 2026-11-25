import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FamilyRole, MemberStatus, RecordStatus } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-codes';
import type { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from './families.service';

const userId = 'user';
const familyId = 'family';
const ownedFamily = {
  id: familyId,
  status: RecordStatus.ACTIVE,
  members: {
    some: { userId, status: MemberStatus.ACTIVE, role: FamilyRole.OWNER },
  },
};

function setup() {
  const prisma = {
    family: { updateManyAndReturn: jest.fn().mockResolvedValue([]) },
    member: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return {
    prisma,
    service: new FamiliesService(prisma as unknown as PrismaService),
  };
}

describe('FamiliesService', () => {
  it('scopes PATCH to an active owner membership in the write itself', async () => {
    const { prisma, service } = setup();
    const family = { id: familyId, name: 'Updated' };
    prisma.family.updateManyAndReturn.mockResolvedValue([family]);

    await expect(
      service.update(userId, familyId, { name: 'Updated' }),
    ).resolves.toEqual({
      ...family,
      role: FamilyRole.OWNER,
    });
    expect(prisma.family.updateManyAndReturn).toHaveBeenCalledWith({
      where: ownedFamily,
      data: { name: 'Updated', currency: undefined, calendar: undefined },
    });
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an empty update before attempting a write', () => {
    const { prisma, service } = setup();

    expect(() => service.update(userId, familyId, {})).toThrow(
      expect.objectContaining({ code: ErrorCode.VALIDATION_FAILED }),
    );
    expect(prisma.family.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('returns forbidden when a rejected archive still has a visible non-owner membership', async () => {
    const { prisma, service } = setup();
    prisma.member.findFirst.mockResolvedValue({
      family: { id: familyId },
      role: FamilyRole.ADMIN,
    });

    await expect(service.archive(userId, familyId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.family.updateManyAndReturn).toHaveBeenCalledWith({
      where: ownedFamily,
      data: { status: RecordStatus.INACTIVE },
    });
    expect(prisma.member.findFirst).toHaveBeenCalledWith({
      where: {
        familyId,
        userId,
        status: MemberStatus.ACTIVE,
        family: { status: RecordStatus.ACTIVE },
      },
      select: { family: true, role: true },
    });
  });

  it('hides families that are no longer visible after a rejected write', async () => {
    const { service } = setup();

    await expect(service.archive(userId, familyId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
