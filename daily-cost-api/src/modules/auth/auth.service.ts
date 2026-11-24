import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RecordStatus, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { toPublicUser } from '../users/user.mapper';
import { sha256Hex } from './crypto.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly verification: EmailVerificationService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.passwords.hash(dto.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          passwordHash,
          language: dto.language ?? 'fa',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppException(
          ErrorCode.ALREADY_EXISTS,
          'An account with this email already exists',
          HttpStatus.CONFLICT,
          { fields: ['email'] },
        );
      }
      throw error;
    }

    await this.verification.issue(user);
    return { user: toPublicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const passwordOk = await this.passwords.verify(
      user?.passwordHash,
      dto.password,
    );

    if (!user || !passwordOk || user.status !== RecordStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerifiedAt) {
      throw new AppException(
        ErrorCode.EMAIL_NOT_VERIFIED,
        'Verify your email address before signing in',
        HttpStatus.FORBIDDEN,
      );
    }

    return { user: toPublicUser(user), ...(await this.issueTokens(user.id)) };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    await this.verification.verify(dto.email, dto.code);
    return { verified: true };
  }

  async resendVerification(dto: ResendVerificationDto) {
    await this.verification.resend(dto.email);
    return { success: true };
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId });

    // Opaque random token; only its hash is stored.
    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
