import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_AUTH_NAME } from '../../../config/swagger.config';
import { USER_LANGUAGES } from '../dto/update-me.dto';

export const ApiUsersController = () =>
  applyDecorators(ApiTags('Users'), ApiBearerAuth(SWAGGER_AUTH_NAME));

const apiPublicProfile = (description: string) =>
  applyDecorators(
    ApiOkResponse({
      description,
      schema: {
        example: {
          data: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            fullName: 'Ahmad Tavakoli',
            email: 'ahmad@example.com',
            emailVerified: true,
            language: 'fa',
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          meta: { path: '/api/v1/users/me' },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description:
        'The token is missing, invalid, expired, or belongs to an unavailable account.',
    }),
    ApiNotFoundResponse({
      description:
        'The profile is missing or inactive when accessed after authentication.',
    }),
  );

export const ApiGetMe = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get the current user profile' }),
    apiPublicProfile('Current user profile.'),
  );

export const ApiUpdateMe = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update the current user profile' }),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          fullName: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            description:
              'Leading and trailing whitespace is removed before validation.',
          },
          language: { type: 'string', enum: [...USER_LANGUAGES] },
        },
      },
    }),
    ApiBadRequestResponse({
      description:
        'The body is empty or contains null, invalid, or unsupported fields.',
    }),
    apiPublicProfile('Updated current user profile.'),
  );
