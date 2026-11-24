import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { buildVerificationEmail } from './templates/verification-email';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('MAIL_USER');
    const pass = config.get<string>('MAIL_PASSWORD');
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.transporter = createTransport({
      host: config.get<string>('MAIL_HOST') || 'localhost',
      port: config.getOrThrow<number>('MAIL_PORT'),
      secure: config.getOrThrow<boolean>('MAIL_SECURE'),
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendVerificationCode(
    to: string,
    code: string,
    language: string,
    ttlMinutes: number,
  ): Promise<void> {
    const mail = buildVerificationEmail({ code, language, ttlMinutes });
    await this.transporter.sendMail({ from: this.from, to, ...mail });
  }
}
