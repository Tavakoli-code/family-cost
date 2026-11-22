import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { map, Observable } from 'rxjs';
import { SKIP_RESPONSE_WRAP_KEY } from '../decorators/skip-response-wrap.decorator';
import { Paginated } from '../pagination/paginated';
import { getRequestPath } from '../utils/request-path';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_WRAP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return next.handle();

    const path = getRequestPath(context.switchToHttp().getRequest<Request>());

    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof StreamableFile) return result;

        if (result instanceof Paginated) {
          return {
            data: result.items,
            meta: {
              path,
              total: result.total,
              limit: result.limit,
              offset: result.offset,
            },
          };
        }

        return { data: result ?? null, meta: { path } };
      }),
    );
  }
}
