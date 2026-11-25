import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, ValidateIf } from 'class-validator';
import { trim } from '../../auth/dto/transforms';

export const USER_LANGUAGES = ['fa', 'ps', 'en'] as const;

export class UpdateMeDto {
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsIn(USER_LANGUAGES)
  language?: (typeof USER_LANGUAGES)[number];
}
