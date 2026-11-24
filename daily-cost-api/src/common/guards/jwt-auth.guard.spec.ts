import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { JwtAuthGuard } from './jwt-auth.guard';

const guard = (isPublic: boolean) =>
  new JwtAuthGuard({
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector);

const context = {
  getHandler: () => undefined,
  getClass: () => undefined,
} as unknown as ExecutionContext;

function thrown(fn: () => unknown): AppException {
  try {
    fn();
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected a throw');
}

describe('JwtAuthGuard', () => {
  it('lets @Public() routes through without checking a token', () => {
    expect(guard(true).canActivate(context)).toBe(true);
  });

  describe('handleRequest', () => {
    const g = guard(false);

    it('returns the user when authentication worked', () => {
      expect(g.handleRequest(null, { id: 'u1' }, undefined)).toEqual({ id: 'u1' });
    });

    it('answers a missing token with 401 UNAUTHORIZED', () => {
      const error = thrown(() => g.handleRequest(null, false, new Error('No auth token')));
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.getStatus()).toBe(401);
    });

    it('answers an invalid token with 401 UNAUTHORIZED', () => {
      const info = Object.assign(new Error('invalid signature'), { name: 'JsonWebTokenError' });
      expect(thrown(() => g.handleRequest(null, false, info)).code).toBe('UNAUTHORIZED');
    });

    it('answers an expired token with 401 TOKEN_EXPIRED', () => {
      const info = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
      const error = thrown(() => g.handleRequest(null, false, info));
      expect(error.code).toBe('TOKEN_EXPIRED');
      expect(error.getStatus()).toBe(401);
    });

    it('rethrows errors from the strategy unchanged', () => {
      const boom = new Error('db down');
      expect(() => g.handleRequest(boom, false, undefined)).toThrow(boom);
    });
  });
});