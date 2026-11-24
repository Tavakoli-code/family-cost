import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeEmail, trim } from './transforms';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email address associated with the verification code.',
    example: 'ahmad@example.com',
    format: 'email',
    maxLength: 254,
  })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Six-digit verification code sent to the email address.',
    example: '123456',
    type: String,
    minLength: 6,
    maxLength: 6,
    pattern: '^\\d{6}$',
  })
  @Transform(trim)
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'code must be 6 digits',
  })
  code: string;
}
