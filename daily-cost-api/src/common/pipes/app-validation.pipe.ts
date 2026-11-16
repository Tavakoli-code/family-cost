import { ValidationPipe } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception.factory';

/** One place for the validation settings, shared by main.ts and tests. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true, // strip unknown properties...
    forbidNonWhitelisted: true, // ...and reject them instead
    transform: true, // convert query/body strings to numbers, dates
    exceptionFactory: validationExceptionFactory,
  });
}