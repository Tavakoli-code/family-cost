import { ExecutionContext } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import { extractCurrentUser } from './current-user.decorator';

const context = (user?: unknown) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('extractCurrentUser', () => {
  it('returns the authenticated user', () => {
    expect(extractCurrentUser(undefined, context({ id: 'u1' }))).toEqual({ id: 'u1' });
  });

  it('returns a single field when asked', () => {
    expect(extractCurrentUser('id', context({ id: 'u1' }))).toBe('u1');
  });

  it('throws 401 UNAUTHORIZED when there is no user (route is not protected)', () => {
    try {
      extractCurrentUser(undefined, context());
      throw new Error('expected a throw');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).code).toBe('UNAUTHORIZED');
      expect((e as AppException).getStatus()).toBe(401);
    }
  });
});