import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

// -----------------------------------------------------
// Shared documentation helpers
// -----------------------------------------------------

export const ApiAuthController = () =>
  applyDecorators(ApiTags('Authentication'));

const validationErrorExample = {
  error: {
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    details: [
      {
        field: 'email',
        issues: [
          {
            rule: 'isEmail',
            message: 'email must be an email',
          },
        ],
      },
    ],
    path: '/api/v1/auth/register',
    requestId: 'req-example-123',
  },
};

const publicUserExample = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  fullName: 'Ahmad Tavakoli',
  email: 'ahmad@example.com',
  language: 'fa',
  status: 'ACTIVE',
};

const accessTokenExample = '<jwt-access-token>';
const refreshTokenExample = '<opaque-refresh-token>';

// -----------------------------------------------------
// POST /auth/register
// -----------------------------------------------------

export const ApiRegister = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Register a new account',
      description:
        'Creates a user account using email and password. ' +
        'Issues an email verification code. ' +
        'The account must be verified before login.',
    }),
    ApiBody({
      type: RegisterDto,
      description: 'New user registration details',
    }),
    ApiCreatedResponse({
      description: 'User created successfully. Email verification is required.',
      schema: {
        example: {
          data: {
            user: publicUserExample,
          },
          meta: {
            path: '/api/v1/auth/register',
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid registration data.',
      schema: {
        example: validationErrorExample,
      },
    }),
    ApiConflictResponse({
      description: 'An account with this email already exists.',
      schema: {
        example: {
          error: {
            code: 'ALREADY_EXISTS',
            message: 'An account with this email already exists',
            details: {
              fields: ['email'],
            },
            path: '/api/v1/auth/register',
            requestId: 'req-example-123',
          },
        },
      },
    }),
  );

// -----------------------------------------------------
// POST /auth/login
// -----------------------------------------------------

export const ApiLogin = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Sign in to Daily Cost',
      description:
        'Authenticates a verified, active user using email ' +
        'and password. Returns the public user profile, ' +
        'a JWT access token, and an opaque refresh token.',
    }),
    ApiBody({
      type: LoginDto,
      description: 'Email and password',
    }),
    ApiOkResponse({
      description: 'Authentication successful.',
      schema: {
        example: {
          data: {
            user: publicUserExample,
            accessToken: accessTokenExample,
            refreshToken: refreshTokenExample,
          },
          meta: {
            path: '/api/v1/auth/login',
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid request body.',
    }),
    ApiUnauthorizedResponse({
      description: 'Email or password is incorrect, or account is inactive.',
      schema: {
        example: {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            path: '/api/v1/auth/login',
            requestId: 'req-example-123',
          },
        },
      },
    }),
    ApiForbiddenResponse({
      description: 'Email verification is required before login.',
      schema: {
        example: {
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Verify your email address before signing in',
            path: '/api/v1/auth/login',
            requestId: 'req-example-123',
          },
        },
      },
    }),
  );

// -----------------------------------------------------
// POST /auth/verify-email
// -----------------------------------------------------

export const ApiVerifyEmail = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify email address',
      description:
        'Verifies a registered email address using the ' +
        'verification code sent to the user.',
    }),
    ApiBody({
      type: VerifyEmailDto,
      description: 'Email address and verification code',
    }),
    ApiOkResponse({
      description: 'Email verified successfully.',
      schema: {
        example: {
          data: {
            verified: true,
          },
          meta: {
            path: '/api/v1/auth/verify-email',
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid verification request or code.',
    }),
  );

// -----------------------------------------------------
// POST /auth/resend-verification
// -----------------------------------------------------

export const ApiResendVerification = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resend email verification code',
      description:
        'Requests another verification code for an email address. ' +
        'This endpoint does not require an access token.',
    }),
    ApiBody({
      type: ResendVerificationDto,
      description: 'Email address to resend verification to',
    }),
    ApiOkResponse({
      description: 'Verification resend request processed.',
      schema: {
        example: {
          data: {
            success: true,
          },
          meta: {
            path: '/api/v1/auth/resend-verification',
          },
        },
      },
    }),
    ApiBadRequestResponse({
      description: 'Invalid resend request.',
    }),
  );

export const ApiRefresh = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Rotate refresh token',
      description:
        'Exchanges a valid refresh token for a new access ' +
        'token and refresh token. The previous refresh token ' +
        'is revoked. Reusing a revoked token revokes all ' +
        'active refresh sessions belonging to the user.',
    }),
    ApiBody({
      type: RefreshTokenDto,
    }),
    ApiOkResponse({
      description: 'Token rotation successful.',
      schema: {
        example: {
          data: {
            accessToken: '<jwt-access-token>',
            refreshToken: '<new-opaque-refresh-token>',
          },
          meta: {
            path: '/api/v1/auth/refresh',
          },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Invalid, expired or reused refresh token.',
      schema: {
        example: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired refresh token',
            path: '/api/v1/auth/refresh',
            requestId: 'req-example-123',
          },
        },
      },
    }),
  );

export const ApiLogout = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Log out a session',
      description:
        'Revokes the submitted refresh token. Repeated ' +
        'logout requests return success. Other sessions ' +
        'are not affected by normal logout.',
    }),
    ApiBody({
      type: RefreshTokenDto,
    }),
    ApiOkResponse({
      description: 'Logout processed successfully.',
      schema: {
        example: {
          data: {
            success: true,
          },
          meta: {
            path: '/api/v1/auth/logout',
          },
        },
      },
    }),
  );
