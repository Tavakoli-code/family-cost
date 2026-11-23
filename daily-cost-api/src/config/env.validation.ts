import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
  ValidationError,
} from 'class-validator';

const NODE_ENVS = ['development', 'production', 'test'];

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

const range = (min: number, max: number) =>
  `must be a whole number between ${min} and ${max}`;

/**
 * Every setting the API reads at startup. Defaults apply when a variable is
 * absent; a variable that is present but blank or malformed is an error.
 * (DB_USER, DB_PASSWORD, DB_NAME and DB_PORT are only used by docker-compose.)
 */
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
