import { ErrorCode } from '../constants/error-codes';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface NormalizedError {
  status: number;
  error: ErrorBody;
}