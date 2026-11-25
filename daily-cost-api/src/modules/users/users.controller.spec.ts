import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Prisma, RecordStatus } from '@prisma/client';
import request from 'supertest';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { createValidationPipe } from '../../common/pipes/app-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const path = '/api/v1/users/me';
const secret = 'x'.repeat(40);
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Ahmad Tavakoli',
  language: 'fa',
  email: 'ahmad@example.com',
  emailVerifiedAt: new Date('2026-01-01'),
  passwordHash: 'private',
  status: RecordStatus.ACTIVE,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};
const otherId = '22222222-2222-4222-8222-222222222222';
const publicProfile = {
  id: user.id,
  fullName: user.fullName,
  language: user.language,
  email: user.email,
  emailVerified: true,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
};

describe('Current user endpoints', () => {
  let app: INestApplication;
  const authorization = `Bearer ${new JwtService({ secret }).sign({ sub: user.id })}`;
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const where = { id: user.id, status: RecordStatus.ACTIVE };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [UsersController],
      providers: [
        UsersService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_ACCESS_SECRET: secret }),
        },
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    prisma.user.findUnique.mockReset().mockResolvedValue(user);
    prisma.user.update.mockReset();
  });

  it('returns only the token owner’s public profile even with another ID in the query', async () => {
    await request(app.getHttpServer())
      .get(path)
      .query({ id: otherId })
      .set('Authorization', authorization)
      .expect(200, { data: publicProfile, meta: { path } });

    expect(prisma.user.findUnique).toHaveBeenLastCalledWith({ where });
  });

  it.each([
    { fullName: '  New Name  ' },
    { language: 'ps' },
    { fullName: '  New Name  ', language: 'en' },
  ])('updates only the supplied profile fields %j', async (body) => {
    const fullName = body.fullName?.trim();
    const language = body.language;
    const updated = {
      fullName: fullName ?? user.fullName,
      language: language ?? user.language,
    };
    prisma.user.update.mockResolvedValue({ ...user, ...updated });

    await request(app.getHttpServer())
      .patch(path)
      .query({ id: otherId })
      .set('Authorization', authorization)
      .send(body)
      .expect(200, { data: { ...publicProfile, ...updated }, meta: { path } });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where,
      data: { fullName, language },
    });
  });

  it.each(
    [
      {},
      [],
      { id: otherId, fullName: 'New Name' },
      { email: 'other@example.com' },
      { passwordHash: 'replacement' },
      { fullName: ' a ' },
      { fullName: ' '.repeat(5) },
      { fullName: 'x'.repeat(101) },
      { fullName: 123 },
      { fullName: null, language: 'fa' },
      { language: 'fr' },
      { language: null, fullName: 'New Name' },
    ].map((body) => [body]),
  )('rejects invalid update %j', async (body) => {
    const response = await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', authorization)
      .send(body)
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a PATCH with no body', async () => {
    await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', authorization)
      .expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it.each(['get', 'patch'] as const)(
    'requires a JWT for %s',
    async (method) => {
      await request(app.getHttpServer())[method](path).expect(401);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it.each([null, { ...user, status: RecordStatus.INACTIVE }])(
    'preserves the JWT rejection for a missing or inactive account',
    async (record) => {
      prisma.user.findUnique.mockResolvedValue(record);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', authorization)
        .expect(401);
      await request(app.getHttpServer())
        .patch(path)
        .set('Authorization', authorization)
        .expect(401);
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it('returns 404 when the active profile cannot be found after authentication', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', authorization)
      .expect(404);
  });

  it('returns 404 when the profile stops matching the active user filter before the update', async () => {
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.19.3',
      }),
    );
    await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', authorization)
      .send({ language: 'ps' })
      .expect(404);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where,
      data: { fullName: undefined, language: 'ps' },
    });
  });
});
