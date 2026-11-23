import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import { RequestWithId } from '../types/request-with-id';

export const REQUEST_ID_HEADER = 'X-Request-Id';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.get(REQUEST_ID_HEADER);
  const requestId =
    incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
