import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail, trim } from './transforms';

export class RegisterDto {
  @ApiProperty({
    description:
      'Full name of the user. Leading and trailing spaces are removed.',
    example: 'Ahmad Tavakoli',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: 'Email address used for registration and verification.',
    example: 'ahmad@example.com',
    format: 'email',
    maxLength: 254,
  })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Password for the new account (8–128 characters).',
    example: 'SecurePassword123!',
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description:
      'Preferred language: fa (Dari), ps (Pashto), or en (English). ' +
      'Defaults to fa when omitted.',
    enum: ['fa', 'ps', 'en'],
    enumName: 'UserLanguage',
    example: 'fa',
    default: 'fa',
  })
  @IsOptional()
  @IsIn(['fa', 'ps', 'en'])
  language?: string;
}
