import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  validateSync,
  ValidationArguments,
  ValidationError,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { normalizeOrigin, parseCorsOrigins } from './cors.config';

const NODE_ENVS = ['development', 'production', 'test'];

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

const range = (min: number, max: number) =>
  `must be a whole number between ${min} and ${max}`;

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

const MAIL_FROM_PATTERN =
  /^(?:[^<>@\r\n]+<[^\s<>@]+@[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+)$/;

@ValidatorConstraint({ name: 'corsOrigins', async: false })
class CorsOriginsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && this.invalid(value).length === 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const bad = this.invalid(String(args.value)).join(', ');
    return `invalid origin(s): ${bad}. Use a comma separated list of origins such as https://admin.example.com (scheme, host, optional port; no path, trailing slash or wildcard)`;
  }

  private invalid(value: string): string[] {
    return parseCorsOrigins(value).filter(
      (entry) => normalizeOrigin(entry) === null,
    );
  }
}

export class EnvironmentVariables {
  @IsIn(NODE_ENVS, { message: `must be one of: ${NODE_ENVS.join(', ')}` })
  NODE_ENV: string = 'development';

  @Transform(toNumber)
  @IsInt({ message: range(1, 65535) })
  @Min(1, { message: range(1, 65535) })
  @Max(65535, { message: range(1, 65535) })
  PORT: number = 3000;

  @IsNotEmpty({ message: 'is required' })
  @Matches(/^postgres(?:ql)?:\/\/\S+$/, {
    message:
      'must be a PostgreSQL connection URL (postgresql://user:password@host:port/database)',
  })
  DATABASE_URL: string;

  @IsNotEmpty({ message: 'is required' })
  @MinLength(32, {
    message:
      "must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
  })
  JWT_ACCESS_SECRET: string;

  @Transform(toNumber)
  @IsInt({ message: range(60, 86400) })
  @Min(60, { message: range(60, 86400) })
  @Max(86400, { message: range(60, 86400) })
  ACCESS_TOKEN_TTL_SECONDS: number = 900;

  @Transform(toNumber)
  @IsInt({ message: range(1, 365) })
  @Min(1, { message: range(1, 365) })
  @Max(365, { message: range(1, 365) })
  REFRESH_TOKEN_TTL_DAYS: number = 30;

  @IsOptional()
  @Validate(CorsOriginsConstraint)
  CORS_ORIGINS?: string;

  // Required in production. In development the mail service falls back to
  // localhost (Mailpit).
  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV === 'production')
  @IsNotEmpty({ message: 'is required in production' })
  MAIL_HOST?: string;

  @Transform(toNumber)
  @IsInt({ message: range(1, 65535) })
  @Min(1, { message: range(1, 65535) })
  @Max(65535, { message: range(1, 65535) })
  MAIL_PORT: number = 1025;

  @Matches(MAIL_FROM_PATTERN, {
    message: 'must be an email address or "Name <address>"',
  })
  MAIL_FROM: string = 'Daily Cost <no-reply@dailycost.local>';

  /** true for implicit TLS (port 465). Port 587 uses STARTTLS with false. */
  @Transform(toBoolean)
  @IsBoolean({ message: 'must be true or false' })
  MAIL_SECURE: boolean = false;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @Transform(toNumber)
  @IsInt({ message: range(1, 60) })
  @Min(1, { message: range(1, 60) })
  @Max(60, { message: range(1, 60) })
  EMAIL_CODE_TTL_MINUTES: number = 15;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(1000)
  AUTH_RATE_LIMIT: number = 10;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(3600)
  AUTH_RATE_WINDOW_SECONDS: number = 60;
}

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

function formatErrors(errors: ValidationError[]): string {
  const lines = errors.map((error) => {
    const constraints = error.constraints ?? {};
    const messages =
      'isNotEmpty' in constraints
        ? [constraints.isNotEmpty]
        : [...new Set(Object.values(constraints))];
    return `  - ${error.property}: ${messages.join('; ')}`;
  });

  return [
    'Invalid environment configuration:',
    ...lines,
    '',
    'Fix the values above in your .env file or environment (see .env.example).',
  ].join('\n');
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env);
  if (errors.length > 0) throw new EnvValidationError(formatErrors(errors));
  return env;
}
