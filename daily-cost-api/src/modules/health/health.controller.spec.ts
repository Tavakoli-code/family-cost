import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  const healthService = {
    check: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new HealthController(
      healthService as unknown as HealthService,
    );
  });

  it('returns the health service result', async () => {
    healthService.check.mockResolvedValue({
      status: 'ok',
      database: 'up',
    });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });

    expect(healthService.check).toHaveBeenCalledTimes(1);
  });

  it('propagates database failure as 503', async () => {
    healthService.check.mockRejectedValue(
      new ServiceUnavailableException('Database unavailable'),
    );

    await expect(controller.check()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
