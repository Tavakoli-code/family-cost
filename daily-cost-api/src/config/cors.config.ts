export interface CorsConfig {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => void;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export function normalizeOrigin(value: string): string | null {
  const candidate = value.trim().toLowerCase();
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin === candidate ? url.origin : null;
  } catch {
    return null;
  }
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const entries = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
  return [...new Set(entries)];
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      LOCAL_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}

export function isOriginAllowed(
  origin: string | undefined,
  allowed: string[],
  isProduction: boolean,
): boolean {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  return !isProduction && allowed.length === 0 && isLocalOrigin(origin);
}

export function buildCorsOptions(
  allowed: string[],
  isProduction: boolean,
): CorsConfig {
  return {
    origin: (origin, callback) =>
      callback(null, isOriginAllowed(origin, allowed, isProduction)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 600,
  };
}

export function describeCors(allowed: string[], isProduction: boolean): string {
  if (allowed.length > 0) return `CORS enabled for: ${allowed.join(', ')}`;
  return isProduction
    ? 'CORS: no browser origins configured (set CORS_ORIGINS for the web admin; the Android app is unaffected)'
    : 'CORS: CORS_ORIGINS is empty, allowing localhost origins only';
}
