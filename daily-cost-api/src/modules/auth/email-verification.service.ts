import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { createHmac, randomInt } from 'crypto';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  VERIFICATION_MAX_ATTEMPTS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from './auth.constants';
import { safeEqualHex } from './crypto.util';

interface VerifiableUser {
  id: string;
  email: string;
  language: string;
}

const codeExpired = () =>
  new AppException(
    ErrorCode.VERIFICATION_CODE_EXPIRED,
    'The verification code has expired or is no longer valid. Request a new one.',
    HttpStatus.BAD_REQUEST,
  );

const codeInvalid = () =>
  new AppException(
    ErrorCode.VERIFICATION_CODE_INVALID,
    'The verification code is incorrect',
    HttpStatus.BAD_REQUEST,
  );

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hashCode(userId: string, code: string): string {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    )
      .update(`email-verification:${userId}:${code}`)
      .digest('hex');
  }

  async issue(user: VerifiableUser): Promise<void> {
    const ttlMinutes = this.config.getOrThrow<number>('EMAIL_CODE_TTL_MINUTES');
    const code = this.generateCode();

    await this.prisma.$transaction([
      this.prisma.emailVerification.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.emailVerification.create({
        data: {
          userId: user.id,
          codeHash: this.hashCode(user.id, code),
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      }),
    ]);

    try {
      await this.mail.sendVerificationCode(
        user.email,
        code,
        user.language,
        ttlMinutes,
      );
    } catch (error) {
      this.logger.error(
        `Could not send verification email to user ${user.id}: ${(error as Error).message}`,
      );
    }
  }

  async resend(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt || user.status !== RecordStatus.ACTIVE)
      return;

    const last = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (
      last &&
      Date.now() - last.createdAt.getTime() < VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      return;
    }

    await this.issue(user);
  }

  async verify(email: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== RecordStatus.ACTIVE) throw codeExpired();
    if (user.emailVerifiedAt) return;

    const record = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.attempts >= VERIFICATION_MAX_ATTEMPTS)
      throw codeExpired();

    const counted = await this.prisma.emailVerification.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        attempts: { lt: VERIFICATION_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) throw codeExpired();

    if (!safeEqualHex(record.codeHash, this.hashCode(user.id, code)))
      throw codeInvalid();

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }
}
