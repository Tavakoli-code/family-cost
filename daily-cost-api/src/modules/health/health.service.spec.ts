import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HEALTH_DB_TIMEOUT_MS, HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();

    service = new HealthService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns ok when PostgreSQL responds', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    queryRaw.mockRejectedValue(new Error('Database connection refused'));

    await expect(service.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('does not expose database error details', async () => {
    queryRaw.mockRejectedValue(
      new Error('password authentication failed for user admin'),
    );

    await expect(service.check()).rejects.toMatchObject({
      message: 'Database unavailable',
    });
  });

  it('returns 503 when the database check times out', async () => {
    jest.useFakeTimers();

    queryRaw.mockImplementation(() => new Promise(() => undefined));

    const result = service.check();
    const assertion = expect(result).rejects.toThrow(
      ServiceUnavailableException,
    );

    await jest.advanceTimersByTimeAsync(HEALTH_DB_TIMEOUT_MS);

    await assertion;
  });
});
