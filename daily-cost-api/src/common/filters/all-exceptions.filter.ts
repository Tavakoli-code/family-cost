import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { defaultErrorCodeForStatus, ErrorCode } from '../constants/error-codes';
import { AppException } from '../exceptions/app.exception';
import { NormalizedError } from '../types/normalized-error';
import { RequestWithId } from '../types/request-with-id';
import { getRequestPath } from '../utils/request-path';
import { mapPrismaError } from './prisma-error.mapper';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<RequestWithId>();

    if (res.headersSent) return;

    const { status, error } = this.normalize(exception);
    const requestId = req.requestId ?? null;
    const path = getRequestPath(req);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${path} -> ${status} requestId=${requestId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.debug(
        `${req.method} ${path} -> ${status} ${error.code} requestId=${requestId}`,
      );
    }

    res.status(status).json({ error: { ...error, path, requestId } });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      };
    }

    // 2) Any other Nest exception (NotFoundException, ForbiddenException, ...)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const raw =
        typeof response === 'string'
          ? response
          : ((response as { message?: unknown }).message ?? exception.message);

      if (Array.isArray(raw)) {
        return {
          status,
          error: {
            code: ErrorCode.VALIDATION_FAILED,
            message: 'Validation failed',
            details: raw,
          },
        };
      }

      return {
        status,
        error: {
          code: defaultErrorCodeForStatus(status),
          message: typeof raw === 'string' ? raw : exception.message,
        },
      };
    }

    const prisma = mapPrismaError(exception);
    if (prisma) return prisma;

    const clientStatus = this.clientErrorStatus(exception);
    if (clientStatus) {
      return {
        status: clientStatus,
        error: {
          code: defaultErrorCodeForStatus(clientStatus),
          message: (exception as Error).message || 'Bad request',
        },
      };
    }

    return {
      status: 500,
      error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
    };
  }

  private clientErrorStatus(exception: unknown): number | null {
    if (typeof exception !== 'object' || exception === null) return null;
    const e = exception as { status?: unknown; statusCode?: unknown };
    const status = e.status ?? e.statusCode;
    return typeof status === 'number' && status >= 400 && status < 500
      ? status
      : null;
  }
}