import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_AUTH_NAME } from '../../../config/swagger.config';
import { CreateFamilyDto } from '../dto/create-family.dto';
import { UpdateFamilyDto } from '../dto/update-family.dto';

export const ApiFamiliesController = () =>
  applyDecorators(ApiTags('Families'), ApiBearerAuth(SWAGGER_AUTH_NAME));

const familyExample = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Tavakoli Family',
  ownerId: '11111111-1111-4111-8111-111111111111',
  currency: 'AFN',
  calendar: 'JALALI',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const ApiCreateFamily = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a family',
      description:
        'Creates a family with the authenticated user as its owner and seeds default income and expense categories. ' +
        'Omitted currency and calendar values default to AFN and JALALI.',
    }),
    ApiBody({ type: CreateFamilyDto }),
    ApiCreatedResponse({
      description: 'Family created successfully.',
      schema: {
        example: {
          data: familyExample,
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

const familyPath = `/api/v1/families/${familyExample.id}`;
const familyWithRole = { ...familyExample, role: 'OWNER' };
const apiUnauthorized = () =>
  ApiUnauthorizedResponse({
    description: 'A valid bearer access token is required.',
  });

const apiFamilyId = () =>
  applyDecorators(
    ApiParam({ name: 'familyId', schema: { type: 'string', format: 'uuid' } }),
    apiUnauthorized(),
    ApiNotFoundResponse({
      description:
        'The family is missing, inactive, or inaccessible to the caller.',
    }),
  );

const apiOwnerOnly = () =>
  ApiForbiddenResponse({
    description: 'The caller is an active member without the OWNER role.',
  });

export const ApiListFamilies = () =>
  applyDecorators(
    ApiOperation({ summary: 'List active families and the caller’s roles' }),
    ApiOkResponse({
      schema: {
        example: { data: [familyWithRole], meta: { path: '/api/v1/families' } },
      },
    }),
    apiUnauthorized(),
  );

export const ApiGetFamily = () =>
  applyDecorators(
    ApiOperation({ summary: 'Get an active family and the caller’s role' }),
    apiFamilyId(),
    ApiBadRequestResponse({ description: 'The family ID must be a UUID.' }),
    ApiOkResponse({
      schema: { example: { data: familyWithRole, meta: { path: familyPath } } },
    }),
  );

export const ApiUpdateFamily = () =>
  applyDecorators(
    ApiOperation({ summary: 'Update an active family as its owner' }),
    apiFamilyId(),
    apiOwnerOnly(),
    ApiBody({
      type: UpdateFamilyDto,
      description:
        'Provide at least one field. Omitted fields keep their current values.',
    }),
    ApiBadRequestResponse({
      description:
        'Invalid family ID or an empty, invalid, or unsupported update.',
    }),
    ApiOkResponse({
      schema: { example: { data: familyWithRole, meta: { path: familyPath } } },
    }),
  );

export const ApiArchiveFamily = () =>
  applyDecorators(
    ApiOperation({ summary: 'Archive an active family as its owner' }),
    apiFamilyId(),
    apiOwnerOnly(),
    ApiBadRequestResponse({ description: 'The family ID must be a UUID.' }),
    ApiOkResponse({
      schema: {
        example: { data: { success: true }, meta: { path: familyPath } },
      },
    }),
  );
