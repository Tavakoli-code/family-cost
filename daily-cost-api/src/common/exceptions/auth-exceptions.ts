import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import { AppException } from './app.exception';

export const unauthorized = () =>
  new AppException(
    ErrorCode.UNAUTHORIZED,
    'Authentication required',
    HttpStatus.UNAUTHORIZED,
  );

export const tokenExpired = () =>
  new AppException(
    ErrorCode.TOKEN_EXPIRED,
    'The access token has expired',
    HttpStatus.UNAUTHORIZED,
  );