import { Controller, Get, INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { RecordStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-request';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

const SECRET = 'x'.repeat(40);
const USER_ID = '11111111-1111-4111-8111-111111111111';

@Controller('probe')
class ProbeController {
  @Get('private')
  privateRoute(@CurrentUser() user: AuthUser) {
    return { id: user.id };
  }

  @Public()
  @Get('open')
  openRoute() {
    return { open: true };
  }
}

describe('global JWT guard (integration)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let baseUrl: string;
  const prisma = { user: { findUnique: jest.fn() } };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_ACCESS_SECRET: SECRET })],
        }),
        PassportModule,
        JwtModule.register({ secret: SECRET }),
      ],
      controllers: [ProbeController],
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    prisma.user.findUnique.mockReset();
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID, status: RecordStatus.ACTIVE });
  });
  afterEach(() => jest.restoreAllMocks());

  const call = async (path: string, authorization?: string) => {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: authorization ? { Authorization: authorization } : {},
    });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const bearer = (token: string) => `Bearer ${token}`;
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

  it('lets @Public() routes through without a token', async () => {
    const { status, body } = await call('/probe/open');
    expect(status).toBe(200);
    expect(body).toEqual({ open: true });
  });

  it('rejects a protected route without a token (401 UNAUTHORIZED)', async () => {
    const { status, body } = await call('/probe/private');
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts a valid token and exposes the user through @CurrentUser()', async () => {
    const { status, body } = await call('/probe/private', bearer(jwt.sign({ sub: USER_ID })));
    expect(status).toBe(200);
    expect(body).toEqual({ id: USER_ID });
  });

  it('answers an expired token with TOKEN_EXPIRED', async () => {
    const token = jwt.sign({ sub: USER_ID, exp: Math.floor(Date.now() / 1000) - 60 });
    const { status, body } = await call('/probe/private', bearer(token));
    expect(status).toBe(401);
    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it.each([
    ['signed with another secret', () => jwt.sign({ sub: USER_ID }, { secret: 'y'.repeat(40) })],
    ['signed with HS512 (algorithm not allowed)', () => jwt.sign({ sub: USER_ID }, { algorithm: 'HS512' })],
    ['using alg none', () => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: USER_ID })}.`],
    ['garbage', () => 'not.a.jwt'],
  ])('rejects a token %s', async (_name, makeToken) => {
    const { status, body } = await call('/probe/private', bearer(makeToken()));
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a non-Bearer scheme', async () => {
    const { status } = await call('/probe/private', `Basic ${jwt.sign({ sub: USER_ID })}`);
    expect(status).toBe(401);
  });

  it('rejects tokens of deleted or inactive accounts', async () => {
    const token = jwt.sign({ sub: USER_ID });

    prisma.user.findUnique.mockResolvedValue(null);
    expect((await call('/probe/private', bearer(token))).status).toBe(401);

    prisma.user.findUnique.mockResolvedValue({ id: USER_ID, status: RecordStatus.INACTIVE });
    expect((await call('/probe/private', bearer(token))).status).toBe(401);
  });

  it('rejects a token whose subject is not a UUID without touching the database', async () => {
    const { status } = await call('/probe/private', bearer(jwt.sign({ sub: 'not-a-uuid' })));
    expect(status).toBe(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not turn a database failure into a 401', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    const { status, body } = await call('/probe/private', bearer(jwt.sign({ sub: USER_ID })));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});