import { EnvValidationError, validateEnv } from './env.validation';

const SECRET = 'x'.repeat(32);
const base = {
  DATABASE_URL: 'postgresql://user:pw123@localhost:5433/db?schema=public',
  JWT_ACCESS_SECRET: SECRET,
};

function failure(env: Record<string, unknown>): EnvValidationError {
  try {
    validateEnv(env);
  } catch (e) {
    return e as EnvValidationError;
  }
  throw new Error('expected validateEnv to throw');
}

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(30);
  });

  it('converts numeric strings to numbers', () => {
    const env = validateEnv({
      ...base,
      PORT: '4000',
      ACCESS_TOKEN_TTL_SECONDS: '600',
      REFRESH_TOKEN_TTL_DAYS: '7',
    });
    expect(env.PORT).toBe(4000);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(600);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('keeps unrelated variables', () => {
    const env = validateEnv({ ...base, SOMETHING_ELSE: 'x' });
    expect((env as unknown as Record<string, unknown>).SOMETHING_ELSE).toBe(
      'x',
    );
  });

  it('names every missing required variable in one error', () => {
    const error = failure({});
    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error.message).toContain('DATABASE_URL: is required');
    expect(error.message).toContain('JWT_ACCESS_SECRET: is required');
  });

  it('treats a blank value as missing', () => {
    expect(failure({ ...base, JWT_ACCESS_SECRET: '' }).message).toContain(
      'JWT_ACCESS_SECRET: is required',
    );
  });

  it('rejects a short JWT secret without printing it', () => {
    const error = failure({ ...base, JWT_ACCESS_SECRET: 'too-short' });
    expect(error.message).toContain('at least 32 characters');
    expect(error.message).not.toContain('too-short');
  });

  it('rejects a non-PostgreSQL DATABASE_URL without printing it', () => {
    const error = failure({
      ...base,
      DATABASE_URL: 'mysql://root:topsecret@localhost/db',
    });
    expect(error.message).toContain('DATABASE_URL: must be a PostgreSQL');
    expect(error.message).not.toContain('topsecret');
  });

  it('accepts the postgres:// scheme', () => {
    expect(() =>
      validateEnv({ ...base, DATABASE_URL: 'postgres://u:p@h:5432/d' }),
    ).not.toThrow();
  });

  it.each(['abc', '0', '65536', '3000.5', '', '  '])(
    'rejects PORT=%p',
    (port) => {
      expect(failure({ ...base, PORT: port }).message).toContain('PORT:');
    },
  );

  it.each(['1', '65535'])('accepts PORT=%p', (port) => {
    expect(validateEnv({ ...base, PORT: port }).PORT).toBe(Number(port));
  });

  it.each([
    ['ACCESS_TOKEN_TTL_SECONDS', '30'],
    ['ACCESS_TOKEN_TTL_SECONDS', '86401'],
    ['ACCESS_TOKEN_TTL_SECONDS', 'soon'],
    ['REFRESH_TOKEN_TTL_DAYS', '0'],
    ['REFRESH_TOKEN_TTL_DAYS', '366'],
    ['REFRESH_TOKEN_TTL_DAYS', 'forever'],
  ])('rejects %s=%p', (name, value) => {
    expect(failure({ ...base, [name]: value }).message).toContain(`${name}:`);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(failure({ ...base, NODE_ENV: 'staging' }).message).toContain(
      'NODE_ENV:',
    );
  });

  it('reports each invalid variable once, even when several rules fail', () => {
    const message = failure({ ...base, PORT: 'abc' }).message;
    expect(message.match(/ PORT:/g)).toHaveLength(1);
  });

  it('lists all problems together', () => {
    const message = failure({ PORT: 'abc', JWT_ACCESS_SECRET: 'x' }).message;
    expect(message).toContain('PORT:');
    expect(message).toContain('DATABASE_URL:');
    expect(message).toContain('JWT_ACCESS_SECRET:');
  });
});

describe('CORS_ORIGINS', () => {
  it('is optional', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('accepts a blank value (no browser origins)', () => {
    expect(() => validateEnv({ ...base, CORS_ORIGINS: '' })).not.toThrow();
  });

  it('accepts a comma separated list', () => {
    const env = validateEnv({
      ...base,
      CORS_ORIGINS: 'https://admin.example.com, http://localhost:5173',
    });
    expect(env.CORS_ORIGINS).toBe(
      'https://admin.example.com, http://localhost:5173',
    );
  });

  it.each([
    '*',
    'https://admin.example.com/',
    'localhost:5173',
    'https://a.com/path',
  ])('rejects %p and names it', (bad) => {
    const message = failure({
      ...base,
      CORS_ORIGINS: `https://ok.example.com,${bad}`,
    }).message;
    expect(message).toContain('CORS_ORIGINS: invalid origin(s)');
    expect(message).toContain(bad.toLowerCase());
    expect(message).not.toContain('https://ok.example.com,');
  });
});

describe('mail settings', () => {
  it('has development defaults (Mailpit)', () => {
    const env = validateEnv(base);
    expect(env.MAIL_PORT).toBe(1025);
    expect(env.MAIL_SECURE).toBe(false);
    expect(env.MAIL_FROM).toContain('no-reply@');
    expect(env.EMAIL_CODE_TTL_MINUTES).toBe(15);
  });

  it('requires MAIL_HOST in production only', () => {
    expect(failure({ ...base, NODE_ENV: 'production' }).message).toContain(
      'MAIL_HOST: is required in production',
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        MAIL_HOST: 'smtp.example.com',
      }),
    ).not.toThrow();
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('treats blank MAIL_USER and MAIL_PASSWORD as not set', () => {
    const env = validateEnv({ ...base, MAIL_USER: '', MAIL_PASSWORD: ' ' });
    expect(env.MAIL_USER).toBeUndefined();
    expect(env.MAIL_PASSWORD).toBeUndefined();
  });

  it('accepts true and false for MAIL_SECURE and rejects other spellings', () => {
    expect(validateEnv({ ...base, MAIL_SECURE: 'true' }).MAIL_SECURE).toBe(
      true,
    );
    expect(validateEnv({ ...base, MAIL_SECURE: 'false' }).MAIL_SECURE).toBe(
      false,
    );
    for (const bad of ['yes', '1', 'TRUE']) {
      expect(failure({ ...base, MAIL_SECURE: bad }).message).toContain(
        'MAIL_SECURE:',
      );
    }
  });

  it('accepts MAIL_FROM with a display name and rejects malformed values', () => {
    expect(() =>
      validateEnv({ ...base, MAIL_FROM: 'Daily Cost <a@b.com>' }),
    ).not.toThrow();
    for (const bad of [
      'not an email',
      'Name <bad>',
      'a@b.com\r\nBcc: x@y.com',
    ]) {
      expect(failure({ ...base, MAIL_FROM: bad }).message).toContain(
        'MAIL_FROM:',
      );
    }
  });

  it.each(['0', '61', 'soon'])('rejects EMAIL_CODE_TTL_MINUTES=%p', (value) => {
    expect(
      failure({ ...base, EMAIL_CODE_TTL_MINUTES: value }).message,
    ).toContain('EMAIL_CODE_TTL_MINUTES:');
  });
});
