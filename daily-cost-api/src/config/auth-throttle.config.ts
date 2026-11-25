import { ConfigService } from '@nestjs/config';
import { seconds } from '@nestjs/throttler';

export const DEFAULT_AUTH_RATE_LIMIT = 10;
export const DEFAULT_AUTH_RATE_WINDOW_SECONDS = 60;

export interface AuthThrottleOptions {
  throttlers: {
    ttl: number;
    limit: number;
  }[];
}

export function buildAuthThrottleOptions(config: ConfigService) {
  const limit = config.getOrThrow<number>('AUTH_RATE_LIMIT');

  const windowSeconds = config.getOrThrow<number>('AUTH_RATE_WINDOW_SECONDS');

  return {
    throttlers: [
      {
        ttl: seconds(windowSeconds),
        limit,
      },
    ],
    errorMessage: 'Too many requests',
  };
}
