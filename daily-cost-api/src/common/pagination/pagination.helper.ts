import { Paginated } from './paginated';
import { PaginationQueryDto } from './dto/pagination-query.dto';

export function createPaginated<T>(
  items: T[],
  total: number,
  pagination: PaginationQueryDto,
): Paginated<T> {
  return {
    items,
    total,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}
