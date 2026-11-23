import {
  buildCorsOptions,
  describeCors,
  isOriginAllowed,
  normalizeOrigin,
  parseCorsOrigins,
} from './cors.config';

describe('parseCorsOrigins', () => {
  it('returns an empty list when unset or blank', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins(' , ,')).toEqual([]);
  });

  it('splits on commas, trims, lowercases and removes duplicates', () => {
    expect(
      parseCorsOrigins(
        ' https://Admin.Example.com , http://localhost:5173,https://admin.example.com ',
      ),
    ).toEqual(['https://admin.example.com', 'http://localhost:5173']);
  });
});

describe('normalizeOrigin', () => {
  it.each([
    'https://admin.example.com',
    'http://localhost:5173',
    'http://127.0.0.1:3001',
    'HTTPS://Admin.Example.com',
  ])('accepts %s', (value) => {
    expect(normalizeOrigin(value)).toBe(value.toLowerCase());
  });

  it.each([
    ['wildcard', '*'],
    ['no scheme', 'localhost:5173'],
    ['trailing slash', 'https://admin.example.com/'],
    ['path', 'https://admin.example.com/app'],
    ['default port', 'https://admin.example.com:443'],
    ['other scheme', 'ftp://admin.example.com'],
    ['spaces inside', 'https://admin example.com'],
    ['the string null', 'null'],
    ['empty', ''],
  ])('rejects %s', (_name, value) => {
    expect(normalizeOrigin(value)).toBeNull();
  });
});

describe('isOriginAllowed', () => {
  const list = ['https://admin.example.com', 'http://localhost:5173'];

  it('always allows requests without an Origin header (Android, curl)', () => {
    expect(isOriginAllowed(undefined, [], true)).toBe(true);
    expect(isOriginAllowed(undefined, list, true)).toBe(true);
  });

  it('allows listed origins and rejects others', () => {
    expect(isOriginAllowed('https://admin.example.com', list, true)).toBe(true);
    expect(isOriginAllowed('https://evil.example.com', list, true)).toBe(false);
  });

  it('is exact: no subdomain, scheme or port tricks', () => {
    expect(
      isOriginAllowed('https://admin.example.com.evil.com', list, true),
    ).toBe(false);
    expect(isOriginAllowed('http://admin.example.com', list, true)).toBe(false);
    expect(isOriginAllowed('https://admin.example.com:8443', list, true)).toBe(
      false,
    );
  });

  it('allows nothing from browsers in production when the list is empty', () => {
    expect(isOriginAllowed('http://localhost:5173', [], true)).toBe(false);
    expect(isOriginAllowed('https://admin.example.com', [], true)).toBe(false);
  });

  it('allows localhost origins in development when the list is empty', () => {
    expect(isOriginAllowed('http://localhost:5173', [], false)).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3001', [], false)).toBe(true);
    expect(isOriginAllowed('https://localhost:8443', [], false)).toBe(true);
  });

  it('still rejects non-local origins and look-alikes in development', () => {
    expect(isOriginAllowed('http://evil.com', [], false)).toBe(false);
    expect(isOriginAllowed('http://localhost.evil.com', [], false)).toBe(false);
    expect(isOriginAllowed('null', [], false)).toBe(false);
    expect(isOriginAllowed('file://', [], false)).toBe(false);
  });

  it('uses only the configured list in development when one is set', () => {
    expect(isOriginAllowed('http://localhost:9999', list, false)).toBe(false);
    expect(isOriginAllowed('http://localhost:5173', list, false)).toBe(true);
  });
});

describe('buildCorsOptions', () => {
  const options = buildCorsOptions(['https://admin.example.com'], true);

  const decide = (origin: string | undefined) => {
    let result: boolean | undefined;
    options.origin(origin, (error, allow) => {
      expect(error).toBeNull();
      result = allow;
    });
    return result;
  };

  it('decides per origin through the callback', () => {
    expect(decide('https://admin.example.com')).toBe(true);
    expect(decide('https://evil.example.com')).toBe(false);
    expect(decide(undefined)).toBe(true);
  });

  it('allows the headers the web admin needs and exposes the request id', () => {
    expect(options.allowedHeaders).toEqual(
      expect.arrayContaining(['Authorization', 'Content-Type', 'X-Request-Id']),
    );
    expect(options.exposedHeaders).toContain('X-Request-Id');
  });

  it('does not use cookies and caps the preflight cache', () => {
    expect(options.credentials).toBe(false);
    expect(options.maxAge).toBe(600);
  });

  it('allows the API methods only', () => {
    expect(options.methods).toEqual(
      expect.arrayContaining(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
    );
    expect(options.methods).not.toContain('TRACE');
  });
});

describe('describeCors', () => {
  it('lists the configured origins', () => {
    expect(describeCors(['https://a.com', 'https://b.com'], true)).toBe(
      'CORS enabled for: https://a.com, https://b.com',
    );
  });

  it('explains the empty cases', () => {
    expect(describeCors([], true)).toContain('no browser origins configured');
    expect(describeCors([], false)).toContain('localhost');
  });
});
