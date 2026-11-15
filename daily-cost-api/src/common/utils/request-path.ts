import { Request } from 'express';

export function getRequestPath(req: Pick<Request, 'originalUrl' | 'url'>): string {
  return (req.originalUrl ?? req.url).split('?')[0];
}