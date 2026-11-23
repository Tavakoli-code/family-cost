import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

export const ApiHealthController = () => applyDecorators(ApiTags('Health'));

export const ApiHealthCheck = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Check API and database readiness',
      description: 'Public endpoint that verifies PostgreSQL connectivity.',
    }),
    ApiResponse({
      status: 200,
      description: 'API and database are available.',
      schema: {
        example: {
          status: 'ok',
          database: 'up',
        },
      },
    }),
    ApiResponse({
      status: 503,
      description: 'Database unavailable.',
      schema: {
        example: {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Database unavailable',
            path: '/health',
            requestId: 'req-example-123',
          },
        },
      },
    }),
  );
