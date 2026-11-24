import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from './transforms';

export class LoginDto {
  @ApiProperty({
    description:
      'Registered email address. Trimmed and converted to lowercase.',
    example: 'ahmad@example.com',
    format: 'email',
    maxLength: 254,
  })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Account password.',
    example: 'SecurePassword123!',
    type: String,
    format: 'password',
    writeOnly: true,
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
