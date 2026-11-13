import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../exceptions/app.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown, requestId?: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status, headersSent: false }),
      getRequest: () => ({ method: 'GET', url: '/x?token=abc', path: '/x', requestId }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps code, message, details and status of an AppException', () => {
    const { status, body } = run(
      new AppException(ErrorCode.CONFLICT, 'Version mismatch', HttpStatus.CONFLICT, { expected: 2 }),
      'req-1',
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      error: { code: 'CONFLICT', message: 'Version mismatch', details: { expected: 2 }, path: '/x', requestId: 'req-1' },
    });
  });

  it.each([
    [new NotFoundException('Wallet not found'), 404, 'NOT_FOUND', 'Wallet not found'],
    [new ForbiddenException('No access'), 403, 'FORBIDDEN', 'No access'],
    [new UnauthorizedException('Invalid credentials'), 401, 'UNAUTHORIZED', 'Invalid credentials'],
  ])('maps %p to a default code', (exception, expectedStatus, code, message) => {
    const { status, body } = run(exception);
    expect(status).toBe(expectedStatus);
    expect(body).toEqual({ error: { code, message, path: '/x', requestId: null } });
  });

  it('turns ValidationPipe message arrays into VALIDATION_FAILED', () => {
    const { status, body } = run(new BadRequestException(['amountMinor must not be less than 1']));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual(['amountMinor must not be less than 1']);
  });

  it('treats library 4xx errors (e.g. malformed JSON) as client errors', () => {
    const error = Object.assign(new SyntaxError('Unexpected token } in JSON'), { status: 400 });
    const { status, body } = run(error);
    expect(status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('hides internals of unknown errors behind a generic 500', () => {
    const { status, body } = run(new Error('connection to db at 10.0.0.5 failed'));
    expect(status).toBe(500);
    expect(body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error', path: '/x', requestId: null });
    expect(JSON.stringify(body)).not.toContain('10.0.0.5');
  });

  it('does not include the query string in path', () => {
  const { body } = run(new NotFoundException());
  expect(body.error.path).toBe('/x');
});
});