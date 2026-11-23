import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const HEALTH_DB_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{
    status: 'ok';
    database: 'up';
  }> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Health check timed out')),
            HEALTH_DB_TIMEOUT_MS,
          );
        }),
      ]);

      return {
        status: 'ok',
        database: 'up',
      };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
