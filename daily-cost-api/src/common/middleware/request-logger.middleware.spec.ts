import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id';
import { requestLoggerMiddleware } from './request-logger.middleware';

function run(statusCode: number, requestId: string | null = 'req-1') {
  const req = {
    method: 'GET',
    url: '/wallets?token=secret',
    originalUrl: '/api/v1/wallets?token=secret',
    requestId: requestId ?? undefined,
  } as unknown as RequestWithId;
  const res = Object.assign(new EventEmitter(), {
    statusCode,
  }) as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;
  requestLoggerMiddleware(req, res, next);
  return { res, next };
}

describe('requestLoggerMiddleware', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('calls next and logs nothing until the response finishes', () => {
    const { next } = run(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs method, path, status, duration and request id', () => {
    const { res } = run(200);
    res.emit('finish');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(
      /^GET \/api\/v1\/wallets 200 \d+\.\dms requestId=req-1$/,
    );
  });

  it('never logs the query string', () => {
    const { res } = run(200);
    res.emit('finish');
    expect(log.mock.calls[0][0]).not.toContain('secret');
  });

  it('logs 4xx as warn', () => {
    run(404).res.emit('finish');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs 5xx as error', () => {
    run(500).res.emit('finish');
    expect(error).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('prints a dash when there is no request id', () => {
    run(200, null).res.emit('finish');
    expect(log.mock.calls[0][0]).toContain('requestId=-');
  });

  it('adds the user id for authenticated requests', () => {
    const req = {
      method: 'GET',
      url: '/x',
      originalUrl: '/api/v1/x',
      requestId: 'req-1',
      user: { id: 'user-1' },
    } as unknown as RequestWithId;
    const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as Response;
    requestLoggerMiddleware(req, res, jest.fn() as unknown as NextFunction);
    res.emit('finish');
    expect(log.mock.calls[0][0]).toMatch(/requestId=req-1 userId=user-1$/);
  });
});
