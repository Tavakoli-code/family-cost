import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '../constants/error-codes';
import { NormalizedError } from '../types/normalized-error';

const DB_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

function uniqueFields(meta: Record<string, unknown> | undefined): string[] | undefined {
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  return undefined;
}

export function mapPrismaError(exception: unknown): NormalizedError | null {
  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return unavailable();
  }

  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) return null;

  if (DB_UNAVAILABLE_CODES.has(exception.code)) return unavailable();

  switch (exception.code) {
    case 'P2002': {
      const fields = uniqueFields(exception.meta);
      return {
        status: HttpStatus.CONFLICT,
        error: {
          code: ErrorCode.ALREADY_EXISTS,
          message: 'A record with the same unique value already exists',
          details: fields ? { fields } : undefined,
        },
      };
    }
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        error: { code: ErrorCode.NOT_FOUND, message: 'Record not found' },
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        error: {
          code: ErrorCode.CONFLICT,
          message: 'The operation conflicts with related records',
        },
      };
    case 'P2034':
      return {
        status: HttpStatus.CONFLICT,
        error: {
          code: ErrorCode.CONFLICT,
          message: 'The operation conflicted with another change. Please retry.',
        },
      };
    default:
      return null;
  }
}

function unavailable(): NormalizedError {
  return {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    error: {
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'Service temporarily unavailable',
    },
  };
}