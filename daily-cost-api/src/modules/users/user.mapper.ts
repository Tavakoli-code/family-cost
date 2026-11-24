import { User } from '@prisma/client';

export function toPublicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    language: user.language,
    status: user.status,
    createdAt: user.createdAt,
  };
}
