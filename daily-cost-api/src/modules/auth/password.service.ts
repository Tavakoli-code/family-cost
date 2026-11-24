import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit() {
    this.dummyHash = await argon2.hash(randomBytes(16).toString('hex'));
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verify(
    hash: string | null | undefined,
    password: string,
  ): Promise<boolean> {
    const matches = await argon2
      .verify(hash || this.dummyHash, password)
      .catch(() => false);
    return hash ? matches : false;
  }
}
