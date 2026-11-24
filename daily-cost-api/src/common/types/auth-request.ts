import { RequestWithId } from './request-with-id';

export interface AuthUser {
  id: string;
}

export interface AuthenticatedRequest extends RequestWithId {
  user: AuthUser;
}