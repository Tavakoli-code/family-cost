import { Prisma, RecordStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthService } from './auth.service';
import { sha256Hex } from './crypto.util';
import { PasswordService } from './password.service';

const PASSWORD = 'correct horse battery';
const passwords = new PasswordService();
let passwordHash: string;

beforeAll(async () => {
  await passwords.onModuleInit();
  passwordHash = await passwords.hash(PASSWORD);
});
afterEach(() => jest.restoreAllMocks());

const storedUser = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  fullName: 'Ali Ahmadi',
  email: 'ali@example.com',
  passwordHash,
  language: 'fa',
  status: RecordStatus.ACTIVE,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  ...over,
});

function setup() {
  const prisma = {
    user: { create: jest.fn(), findUnique: jest.fn() },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt.token') };
  const config = {
    getOrThrow: (key: string) => ({ REFRESH_TOKEN_TTL_DAYS: 30 })[key],
  };
  const verification = {
    issue: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn().mockResolvedValue(undefined),
    resend: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    passwords,
    verification as never,
  );
  return { prisma, jwt, verification, service };
}

async function failure(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected a rejection');
}

const credentials = { email: 'ali@example.com', password: PASSWORD };

describe('AuthService.register', () => {
  const dto = {
    fullName: 'Ali Ahmadi',
    email: 'ali@example.com',
    password: PASSWORD,
  };

  it('stores an argon2 hash, sends a verification code and returns no tokens', async () => {
    const { prisma, verification, service } = setup();
    prisma.user.create.mockImplementation(async ({ data }) =>
      storedUser({ ...data, emailVerifiedAt: null }),
    );

    const result = await service.register(dto);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(data.passwordHash).not.toContain(PASSWORD);
    expect(data.email).toBe('ali@example.com');
    expect(data.language).toBe('fa');

    expect(verification.issue).toHaveBeenCalledTimes(1);
    expect(result.user.emailVerified).toBe(false);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');
  });

  it('uses the language the user chose', async () => {
    const { prisma, service } = setup();
    prisma.user.create.mockImplementation(async ({ data }) => storedUser(data));
    await service.register({ ...dto, language: 'ps' });
    expect(prisma.user.create.mock.calls[0][0].data.language).toBe('ps');
  });

  it('returns 409 ALREADY_EXISTS for a duplicate email and sends nothing', async () => {
    const { prisma, verification, service } = setup();
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: Prisma.prismaVersion.client,
      }),
    );

    const error = await failure(service.register(dto));

    expect(error.code).toBe('ALREADY_EXISTS');
    expect(error.getStatus()).toBe(409);
    expect(verification.issue).not.toHaveBeenCalled();
  });

  it('rethrows unexpected database errors', async () => {
    const { prisma, service } = setup();
    prisma.user.create.mockRejectedValue(new Error('connection lost'));
    await expect(service.register(dto)).rejects.toThrow('connection lost');
  });
});

describe('AuthService.login', () => {
  it('returns the user with an access token and a refresh token', async () => {
    const { prisma, jwt, service } = setup();
    prisma.user.findUnique.mockResolvedValue(storedUser());

    const result = await service.login(credentials);

    expect(result.accessToken).toBe('access.jwt.token');
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
    expect(result.refreshToken.length).toBeGreaterThanOrEqual(60);
    expect(result.user.email).toBe('ali@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('stores only the hash of the refresh token', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(storedUser());

    const { refreshToken } = await service.login(credentials);

    const data = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(data.userId).toBe('u1');
    expect(data.tokenHash).toBe(sha256Hex(refreshToken));
    expect(data.tokenHash).not.toBe(refreshToken);
    const days = (data.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('rejects a wrong password with 401 INVALID_CREDENTIALS and issues nothing', async () => {
    const { prisma, jwt, service } = setup();
    prisma.user.findUnique.mockResolvedValue(storedUser());

    const error = await failure(
      service.login({ ...credentials, password: 'nope-nope' }),
    );

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(error.getStatus()).toBe(401);
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('answers an unknown email exactly like a wrong password, and still hashes', async () => {
    const { prisma, service } = setup();
    const verifySpy = jest.spyOn(passwords, 'verify');
    prisma.user.findUnique.mockResolvedValue(storedUser());
    const wrongPassword = await failure(
      service.login({ ...credentials, password: 'nope-nope' }),
    );

    prisma.user.findUnique.mockResolvedValue(null);
    const unknownEmail = await failure(service.login(credentials));

    expect(unknownEmail.code).toBe(wrongPassword.code);
    expect(unknownEmail.message).toBe(wrongPassword.message);
    expect(unknownEmail.getStatus()).toBe(wrongPassword.getStatus());
    expect(verifySpy).toHaveBeenLastCalledWith(undefined, PASSWORD);
  });

  it('blocks unverified accounts with 403 EMAIL_NOT_VERIFIED', async () => {
    const { prisma, jwt, service } = setup();
    prisma.user.findUnique.mockResolvedValue(
      storedUser({ emailVerifiedAt: null }),
    );

    const error = await failure(service.login(credentials));

    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(error.getStatus()).toBe(403);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('does not reveal verification status to someone with a wrong password', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(
      storedUser({ emailVerifiedAt: null }),
    );
    const error = await failure(
      service.login({ ...credentials, password: 'nope-nope' }),
    );
    expect(error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects inactive accounts as invalid credentials', async () => {
    const { prisma, service } = setup();
    prisma.user.findUnique.mockResolvedValue(
      storedUser({ status: RecordStatus.INACTIVE }),
    );
    expect((await failure(service.login(credentials))).code).toBe(
      'INVALID_CREDENTIALS',
    );
  });
});

describe('AuthService verification endpoints', () => {
  it('verifyEmail delegates and returns verified: true', async () => {
    const { verification, service } = setup();
    const result = await service.verifyEmail({
      email: 'ali@example.com',
      code: '123456',
    });
    expect(verification.verify).toHaveBeenCalledWith(
      'ali@example.com',
      '123456',
    );
    expect(result).toEqual({ verified: true });
  });

  it('resendVerification always reports success', async () => {
    const { verification, service } = setup();
    const result = await service.resendVerification({
      email: 'ali@example.com',
    });
    expect(verification.resend).toHaveBeenCalledWith('ali@example.com');
    expect(result).toEqual({ success: true });
  });
});
