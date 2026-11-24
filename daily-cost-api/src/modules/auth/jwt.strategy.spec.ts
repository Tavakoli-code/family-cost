import { ConfigService } from '@nestjs/config';
import { RecordStatus } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { JwtStrategy } from './jwt.strategy';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function setup() {
  const prisma = { user: { findUnique: jest.fn() } };
  const config = { getOrThrow: () => 'x'.repeat(40) } as unknown as ConfigService;
  return { prisma, strategy: new JwtStrategy(config, prisma as never) };
}

async function failure(promise: Promise<unknown>): Promise<AppException> {
  try {
    await promise;
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected a rejection');
}

describe('JwtStrategy.validate', () => {
  it('returns the user id for an active account', async () => {
    const { prisma, strategy } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID, status: RecordStatus.ACTIVE });

    expect(await strategy.validate({ sub: USER_ID })).toEqual({ id: USER_ID });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { id: true, status: true },
    });
  });

  it('rejects an account that no longer exists', async () => {
    const { prisma, strategy } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    expect((await failure(strategy.validate({ sub: USER_ID }))).code).toBe('UNAUTHORIZED');
  });

  it('rejects an inactive account', async () => {
    const { prisma, strategy } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID, status: RecordStatus.INACTIVE });
    expect((await failure(strategy.validate({ sub: USER_ID }))).code).toBe('UNAUTHORIZED');
  });

  it.each([undefined, '', 'not-a-uuid', 123, null])(
    'rejects a bad subject (%p) without querying the database',
    async (sub) => {
      const { prisma, strategy } = setup();
      const error = await failure(strategy.validate({ sub } as never));
      expect(error.code).toBe('UNAUTHORIZED');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('lets database errors through instead of turning them into 401', async () => {
    const { prisma, strategy } = setup();
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    await expect(strategy.validate({ sub: USER_ID })).rejects.toThrow('db down');
  });
});