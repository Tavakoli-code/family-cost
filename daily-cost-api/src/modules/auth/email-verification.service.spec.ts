import { Logger } from '@nestjs/common';
import { RecordStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { EmailVerificationService } from './email-verification.service';

const SECRET = 'x'.repeat(32);

const user = {
  id: 'u1',
  email: 'a@b.com',
  language: 'en',
  status: RecordStatus.ACTIVE,
  emailVerifiedAt: null as Date | null,
};

function setup() {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    emailVerification: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
  };
  const mail = { sendVerificationCode: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getOrThrow: (key: string) =>
      ({ JWT_ACCESS_SECRET: SECRET, EMAIL_CODE_TTL_MINUTES: 15 })[key],
  };
  const service = new EmailVerificationService(
    prisma as never,
    config as never,
    mail as never,
  );
  return { prisma, mail, service };
}

async function failure(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected a rejection');
}

describe('EmailVerificationService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('codes', () => {
    it('generates six digits, zero padded', () => {
      const { service } = setup();
      for (let i = 0; i < 300; i++)
        expect(service.generateCode()).toMatch(/^\d{6}$/);
    });

    it('hashes per user and per code', () => {
      const { service } = setup();
      expect(service.hashCode('u1', '123456')).toBe(
        service.hashCode('u1', '123456'),
      );
      expect(service.hashCode('u1', '123456')).not.toBe(
        service.hashCode('u2', '123456'),
      );
      expect(service.hashCode('u1', '123456')).not.toBe(
        service.hashCode('u1', '123457'),
      );
    });
  });

  describe('issue', () => {
    it('stores only a hash, replaces older codes and emails the code', async () => {
      const { prisma, mail, service } = setup();
      await service.issue(user);

      const code = mail.sendVerificationCode.mock.calls[0][1] as string;
      expect(code).toMatch(/^\d{6}$/);
      expect(mail.sendVerificationCode).toHaveBeenCalledWith(
        'a@b.com',
        code,
        'en',
        15,
      );

      const stored = prisma.emailVerification.create.mock.calls[0][0].data;
      expect(stored.codeHash).toBe(service.hashCode('u1', code));
      expect(stored).not.toHaveProperty('code');

      const ttl = stored.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(14 * 60_000);
      expect(ttl).toBeLessThanOrEqual(15 * 60_000);

      expect(prisma.emailVerification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('does not throw when the mail server is down', async () => {
      const { mail, service } = setup();
      mail.sendVerificationCode.mockRejectedValue(new Error('smtp down'));
      await expect(service.issue(user)).resolves.toBeUndefined();
    });
  });

  describe('resend', () => {
    it('does nothing for an unknown email', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      await service.resend('x@y.com');
      expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('does nothing for an already verified account', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: new Date(),
      });
      await service.resend('a@b.com');
      expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('does nothing during the cooldown', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 10_000),
      });
      await service.resend('a@b.com');
      expect(mail.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('sends a new code after the cooldown', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 61_000),
      });
      await service.resend('a@b.com');
      expect(mail.sendVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('sends a code when none was ever sent', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue(null);
      await service.resend('a@b.com');
      expect(mail.sendVerificationCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('verify', () => {
    const active = (service: EmailVerificationService, over = {}) => ({
      id: 'r1',
      codeHash: service.hashCode('u1', '123456'),
      attempts: 0,
      ...over,
    });

    it('verifies the account with the right code', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue(active(service));
      prisma.emailVerification.updateMany.mockResolvedValue({ count: 1 });

      await service.verify('a@b.com', '123456');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(prisma.emailVerification.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('rejects a wrong code and counts the attempt', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue(active(service));
      prisma.emailVerification.updateMany.mockResolvedValue({ count: 1 });

      const error = await failure(service.verify('a@b.com', '000000'));

      expect(error.code).toBe('VERIFICATION_CODE_INVALID');
      expect(error.getStatus()).toBe(400);
      expect(prisma.emailVerification.updateMany).toHaveBeenCalledWith({
        where: { id: 'r1', usedAt: null, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('treats a missing or expired code as expired', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue(null);
      expect((await failure(service.verify('a@b.com', '123456'))).code).toBe(
        'VERIFICATION_CODE_EXPIRED',
      );
    });

    it('stops accepting guesses after five attempts, even for the right code', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue(
        active(service, { attempts: 5 }),
      );

      expect((await failure(service.verify('a@b.com', '123456'))).code).toBe(
        'VERIFICATION_CODE_EXPIRED',
      );
      expect(prisma.emailVerification.updateMany).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('loses the race when another request used the last attempt', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerification.findFirst.mockResolvedValue(
        active(service, { attempts: 4 }),
      );
      prisma.emailVerification.updateMany.mockResolvedValue({ count: 0 });

      expect((await failure(service.verify('a@b.com', '123456'))).code).toBe(
        'VERIFICATION_CODE_EXPIRED',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('answers an unknown email like a missing code', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      expect((await failure(service.verify('x@y.com', '123456'))).code).toBe(
        'VERIFICATION_CODE_EXPIRED',
      );
    });

    it('succeeds without touching codes when already verified', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        emailVerifiedAt: new Date(),
      });
      await expect(
        service.verify('a@b.com', '123456'),
      ).resolves.toBeUndefined();
      expect(prisma.emailVerification.findFirst).not.toHaveBeenCalled();
    });
  });
});
