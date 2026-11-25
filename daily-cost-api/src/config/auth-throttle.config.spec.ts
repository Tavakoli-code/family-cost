import { ConfigService } from '@nestjs/config';
import { buildAuthThrottleOptions } from './auth-throttle.config';

describe('buildAuthThrottleOptions', () => {
  function createConfig(limit: number, windowSeconds: number): ConfigService {
    return {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'AUTH_RATE_LIMIT') return limit;
        if (key === 'AUTH_RATE_WINDOW_SECONDS') {
          return windowSeconds;
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as ConfigService;
  }

  it('creates the configured rate limit', () => {
    const options = buildAuthThrottleOptions(createConfig(10, 60));

    expect(options).toEqual({
      throttlers: [
        {
          limit: 10,
          ttl: 60_000,
        },
      ],
    });
  });

  it('supports stricter test configuration', () => {
    const options = buildAuthThrottleOptions(createConfig(3, 30));

    expect(options.throttlers[0]).toEqual({
      limit: 3,
      ttl: 30_000,
    });
  });

  it('converts the window from seconds to milliseconds', () => {
    const options = buildAuthThrottleOptions(createConfig(5, 120));

    expect(options.throttlers[0].ttl).toBe(120_000);
  });
});
