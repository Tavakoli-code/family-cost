import { NotFoundException } from '@nestjs/common';
import { Prisma, RecordStatus, type User } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-codes';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

const user: User = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Ahmad Tavakoli',
  email: 'ahmad@example.com',
  emailVerifiedAt: new Date('2026-01-01'),
  language: 'fa',
  status: RecordStatus.ACTIVE,
  passwordHash: 'private',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

const publicProfile = {
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  emailVerified: true,
  language: user.language,
  status: user.status,
  createdAt: user.createdAt,
};

const where = { id: user.id, status: RecordStatus.ACTIVE };

function setup() {
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  return {
    prisma,
    service: new UsersService(prisma as unknown as PrismaService),
  };
}

describe('UsersService', () => {
  it('looks up the active user and returns only public fields', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(service.getMe(user.id)).resolves.toEqual(publicProfile);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where });
  });

  it('throws 404 when the active-user lookup finds no match', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getMe(user.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where });
  });

  it.each<UpdateMeDto>([
    { fullName: 'New Name' },
    { language: 'ps' },
    { fullName: 'New Name', language: 'en' },
  ])(
    'updates the active user with %j and returns the public profile',
    async (update) => {
      const { prisma, service } = setup();
      prisma.user.update.mockResolvedValue({ ...user, ...update });

      await expect(service.updateMe(user.id, update)).resolves.toEqual({
        ...publicProfile,
        ...update,
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where,
        data: { fullName: update.fullName, language: update.language },
      });
    },
  );

  it('rejects an empty update before calling Prisma', async () => {
    const { prisma, service } = setup();

    await expect(service.updateMe(user.id, {})).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('propagates Prisma’s not-found error when the active-user update finds no match', async () => {
    const { prisma, service } = setup();
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: Prisma.prismaVersion.client,
    });
    prisma.user.update.mockRejectedValue(error);

    await expect(service.updateMe(user.id, { language: 'en' })).rejects.toBe(
      error,
    );
  });
});
