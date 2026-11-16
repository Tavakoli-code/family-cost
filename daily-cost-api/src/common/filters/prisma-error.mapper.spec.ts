import { Prisma } from '@prisma/client';
import { mapPrismaError } from './prisma-error.mapper';

const known = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('raw message with table "users"', {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });

describe('mapPrismaError', () => {
  it('maps P2002 to 409 ALREADY_EXISTS and reports the fields', () => {
    const result = mapPrismaError(known('P2002', { target: ['phone'] }));
    expect(result?.status).toBe(409);
    expect(result?.error.code).toBe('ALREADY_EXISTS');
    expect(result?.error.details).toEqual({ fields: ['phone'] });
  });

  it('accepts a string unique target', () => {
    const result = mapPrismaError(known('P2002', { target: 'users_email_key' }));
    expect(result?.error.details).toEqual({ fields: ['users_email_key'] });
  });

  it('omits details when the target is unknown', () => {
    expect(mapPrismaError(known('P2002'))?.error.details).toBeUndefined();
  });

  it('maps P2025 to 404 NOT_FOUND', () => {
    const result = mapPrismaError(known('P2025'));
    expect(result?.status).toBe(404);
    expect(result?.error.code).toBe('NOT_FOUND');
  });

  it.each(['P2003', 'P2034'])('maps %s to 409 CONFLICT', (code) => {
    const result = mapPrismaError(known(code));
    expect(result?.status).toBe(409);
    expect(result?.error.code).toBe('CONFLICT');
  });

  it.each(['P1001', 'P1002', 'P1008', 'P1017'])(
    'maps connection error %s to 503',
    (code) => {
      const result = mapPrismaError(known(code));
      expect(result?.status).toBe(503);
      expect(result?.error.code).toBe('SERVICE_UNAVAILABLE');
    },
  );

  it('maps initialization errors to 503', () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at db:5432",
      Prisma.prismaVersion.client,
    );
    expect(mapPrismaError(error)?.status).toBe(503);
  });

  it('never leaks the raw Prisma message', () => {
    const result = mapPrismaError(known('P2002', { target: ['phone'] }));
    expect(JSON.stringify(result)).not.toContain('raw message');
  });

  it('returns null for other Prisma codes and non-Prisma errors', () => {
    expect(mapPrismaError(known('P9999'))).toBeNull();
    expect(mapPrismaError(new Error('x'))).toBeNull();
    expect(mapPrismaError('nope')).toBeNull();
  });
});