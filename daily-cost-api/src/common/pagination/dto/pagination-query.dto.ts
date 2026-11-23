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
  @Transform(({ value }) => parseQueryInteger(value))
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit: number = DEFAULT_PAGE_LIMIT;

  @Transform(({ value }) => parseQueryInteger(value))
  @IsInt()
  @Min(0)
  offset: number = DEFAULT_PAGE_OFFSET;
}
