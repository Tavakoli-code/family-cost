import { Logger } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id';
import { getRequestPath } from '../utils/request-path';

const logger = new Logger('HTTP');

export function requestLoggerMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const line = `${req.method} ${getRequestPath(req)} ${status} ${ms.toFixed(1)}ms requestId=${req.requestId ?? '-'}`;

    if (status >= 500) logger.error(line);
    else if (status >= 400) logger.warn(line);
    else logger.log(line);
  });

  next();
}
