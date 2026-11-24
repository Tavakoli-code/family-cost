import { HttpStatus } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { sha256Hex } from './crypto.util';

describe('AuthService refresh rotation', () => {
  const rawToken = 'A'.repeat(64);

  let service: AuthService;
  let tx: {
    refreshToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };

  let prisma: {
    $transaction: jest.Mock;
    refreshToken: {
      updateMany: jest.Mock;
    };
  };

  const jwt = {
    signAsync: jest.fn(),
  };

  const config = {
    getOrThrow: jest.fn(),
  };

  const activeToken = () => ({
    id: 'token-1',
    userId: 'user-1',
    tokenHash: sha256Hex(rawToken),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    user: {
      id: 'user-1',
      status: RecordStatus.ACTIVE,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();

    tx = {
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
      refreshToken: {
        updateMany: jest.fn(),
      },
    };

    jwt.signAsync.mockResolvedValue('new-access-token');
    config.getOrThrow.mockReturnValue(30);

    service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      {} as never,
      {} as never,
    );
  });

  it('rotates a valid token', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(activeToken());

    tx.refreshToken.updateMany.mockResolvedValue({
      count: 1,
    });

    tx.refreshToken.create.mockResolvedValue({});

    const result = await service.refresh({
      refreshToken: rawToken,
    });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).not.toBe(rawToken);
    expect(result.refreshToken).toHaveLength(64);

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'token-1',
          revokedAt: null,
        }),
      }),
    );

    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tokenHash: sha256Hex(result.refreshToken),
      }),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown token', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(null);

    await expect(
      service.refresh({ refreshToken: rawToken }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      ...activeToken(),
      expiresAt: new Date(Date.now() - 86400000),
    });

    await expect(
      service.refresh({ refreshToken: rawToken }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes all sessions when a revoked token is reused', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      ...activeToken(),
      revokedAt: new Date(),
    });

    tx.refreshToken.updateMany.mockResolvedValue({
      count: 2,
    });

    await expect(
      service.refresh({ refreshToken: rawToken }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });

    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('detects a competing token consumption', async () => {
    tx.refreshToken.findUnique.mockResolvedValue(activeToken());

    tx.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 2 });

    await expect(
      service.refresh({ refreshToken: rawToken }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(tx.refreshToken.updateMany).toHaveBeenCalledTimes(2);

    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('does not rotate tokens for inactive users', async () => {
    tx.refreshToken.findUnique.mockResolvedValue({
      ...activeToken(),
      user: {
        id: 'user-1',
        status: RecordStatus.INACTIVE,
      },
    });

    await expect(
      service.refresh({ refreshToken: rawToken }),
    ).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });

    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes a token during logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({
      count: 1,
    });

    await expect(service.logout({ refreshToken: rawToken })).resolves.toEqual({
      success: true,
    });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: sha256Hex(rawToken),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it('allows repeated logout', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.logout({ refreshToken: rawToken })).resolves.toEqual({
      success: true,
    });
  });
});
