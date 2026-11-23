import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;
export const DEFAULT_PAGE_OFFSET = 0;

function parseQueryInteger(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (!/^\d+$/.test(value)) {
    return value;
  }

  return Number(value);
}

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of items to return.',
    type: Number,
    minimum: 1,
    maximum: 200,
    default: 50,
    example: 20,
  })
  @Transform(({ value }) => parseQueryInteger(value))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;

  @ApiPropertyOptional({
    description: 'Number of matching items to skip.',
    type: Number,
    minimum: 0,
    default: 0,
    example: 40,
  })
  @Transform(({ value }) => parseQueryInteger(value))
  @IsInt()
  @Min(0)
  offset: number = DEFAULT_PAGE_OFFSET;
}
