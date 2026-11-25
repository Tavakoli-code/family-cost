import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_AUTH_NAME } from '../../../config/swagger.config';
import { CreateFamilyDto } from '../dto/create-family.dto';

export const ApiFamiliesController = () =>
  applyDecorators(ApiTags('Families'), ApiBearerAuth(SWAGGER_AUTH_NAME));

export const ApiCreateFamily = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a family',
      description:
        'Creates a family with the authenticated user as its owner and seeds default income and expense categories.',
    }),
    ApiBody({ type: CreateFamilyDto }),
    ApiCreatedResponse({
      description: 'Family created successfully.',
      schema: {
        example: {
          data: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Tavakoli Family',
            ownerId: '11111111-1111-4111-8111-111111111111',
            currency: 'AFN',
            calendar: 'JALALI',
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          meta: { path: '/api/v1/families' },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Missing or invalid family details, or unsupported fields.',
    }),
    ApiUnauthorizedResponse({
      description: 'A valid bearer access token is required.',
    }),
  );
