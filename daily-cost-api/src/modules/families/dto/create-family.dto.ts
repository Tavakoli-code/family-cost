import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO4217CurrencyCode,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { trim } from '../../auth/dto/transforms';

export class CreateFamilyDto {
  @ApiProperty({
    description: 'Family name, trimmed before validation.',
    example: 'Tavakoli Family',
    minLength: 1,
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Uppercase ISO 4217 currency code.',
    example: 'USD',
  })
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsISO4217CurrencyCode()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ enum: CalendarType })
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsEnum(CalendarType)
  calendar?: CalendarType;
}
