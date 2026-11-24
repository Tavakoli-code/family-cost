import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      'Opaque refresh token returned by login or a previous refresh.',
    type: String,
    format: 'password',
    writeOnly: true,
    example: 'A'.repeat(64),
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{64}$/, {
    message: 'refreshToken must be a valid refresh token',
  })
  refreshToken: string;
}
