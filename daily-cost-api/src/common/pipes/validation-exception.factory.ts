import { HttpStatus, ValidationError } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../exceptions/app.exception';

export interface ValidationIssue {
  /** class-validator rule name, e.g. "min", "isEmail". The apps localize by this. */
  rule: string;
  /** English text for developers. */
  message: string;
}

export interface ValidationDetail {
  /** Dotted path for nested input, e.g. "line.name" or "lines.0.name". */
  field: string;
  issues: ValidationIssue[];
}

function collect(
  errors: ValidationError[],
  parentPath: string,
  out: ValidationDetail[],
): void {
  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      out.push({
        field,
        issues: Object.entries(error.constraints).map(([rule, message]) => ({
          rule,
          message,
        })),
      });
    }
    if (error.children?.length) collect(error.children, field, out);
  }
}

export function validationExceptionFactory(errors: ValidationError[]): AppException {
  const details: ValidationDetail[] = [];
  collect(errors, '', details);

  return new AppException(
    ErrorCode.VALIDATION_FAILED,
    'Validation failed',
    HttpStatus.BAD_REQUEST,
    details,
  );
}