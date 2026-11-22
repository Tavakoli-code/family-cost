import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { Paginated } from '../pagination/paginated';
import { ResponseInterceptor } from './response.interceptor';

function run(result: unknown, skip = false) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(skip),
  } as unknown as Reflector;
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        url: '/things?x=1',
        originalUrl: '/api/v1/things?x=1',
      }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(result) };
  return lastValueFrom(
    new ResponseInterceptor(reflector).intercept(context, next),
  );
}

describe('ResponseInterceptor', () => {
  it('wraps a plain result in data + meta.path', async () => {
    expect(await run({ id: '1' })).toEqual({
      data: { id: '1' },
      meta: { path: '/api/v1/things' },
    });
  });

  it('keeps the API prefix and drops the query string in path', async () => {
    const body = (await run({ id: '1' })) as { meta: { path: string } };
    expect(body.meta.path).toBe('/api/v1/things');
  });

  it('returns data null when the handler returns nothing', async () => {
    expect(await run(undefined)).toEqual({
      data: null,
      meta: { path: '/api/v1/things' },
    });
  });

  it('wraps arrays and primitives too', async () => {
    expect(await run([1, 2])).toEqual({
      data: [1, 2],
      meta: { path: '/api/v1/things' },
    });
    expect(await run(false)).toEqual({
      data: false,
      meta: { path: '/api/v1/things' },
    });
  });

  it('adds pagination info for Paginated results', async () => {
    expect(await run(new Paginated([{ id: '1' }], 120, 50, 0))).toEqual({
      data: [{ id: '1' }],
      meta: { path: '/api/v1/things', total: 120, limit: 50, offset: 0 },
    });
  });

  it('does not treat a plain object with an items field as a list', async () => {
    expect(await run({ items: [1], total: 1 })).toEqual({
      data: { items: [1], total: 1 },
      meta: { path: '/api/v1/things' },
    });
  });

  it('leaves responses untouched when SkipResponseWrap is set', async () => {
    expect(await run({ status: 'ok' }, true)).toEqual({ status: 'ok' });
  });

  it('does not wrap file streams', async () => {
    const file = new StreamableFile(Buffer.from('x'));
    expect(await run(file)).toBe(file);
  });
});
