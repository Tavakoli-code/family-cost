import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id';
import {
  REQUEST_ID_HEADER,
  requestIdMiddleware,
} from './request-id.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function run(incoming?: string) {
  const req = {
    get: jest.fn().mockReturnValue(incoming),
  } as unknown as RequestWithId;
  const res = { setHeader: jest.fn() } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  requestIdMiddleware(req, res, next);
  return { req, res, next };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when the header is missing', () => {
    const { req, res, next } = run();
    expect(req.requestId).toMatch(UUID);
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      req.requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses a valid incoming id and echoes it in the response header', () => {
    const { req, res } = run('my-trace-123');
    expect(req.requestId).toBe('my-trace-123');
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'my-trace-123',
    );
  });

  it('accepts an id of exactly 64 characters', () => {
    const id = 'a'.repeat(64);
    expect(run(id).req.requestId).toBe(id);
  });

  it.each([
    ['empty', ''],
    ['too long', 'a'.repeat(65)],
    ['spaces', 'bad id'],
    ['newline (log forging)', 'id\nINJECTED'],
    ['punctuation', 'id;drop'],
    ['markup', '<script>'],
  ])('replaces an invalid incoming id (%s)', (_name, value) => {
    const { req, res } = run(value);
    expect(req.requestId).toMatch(UUID);
    expect(res.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      req.requestId,
    );
  });

  it('generates a different id for each request', () => {
    expect(run().req.requestId).not.toBe(run().req.requestId);
  });
});
