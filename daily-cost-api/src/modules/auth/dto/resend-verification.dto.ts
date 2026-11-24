import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { normalizeEmail } from './transforms';

export class ResendVerificationDto {
  @ApiProperty({
    description:
      'Registered email address to which a new verification code will be sent.',
    example: 'ahmad@example.com',
    format: 'email',
    maxLength: 254,
  })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;
}
