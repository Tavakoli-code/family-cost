import { PaginationQueryDto } from './dto/pagination-query.dto';
import { createPaginated } from './pagination.helper';

describe('createPaginated', () => {
  it('returns items with pagination metadata', () => {
    const items = [{ id: '1' }, { id: '2' }];

    const pagination = Object.assign(new PaginationQueryDto(), {
      limit: 20,
      offset: 40,
    });

    expect(createPaginated(items, 120, pagination)).toEqual({
      items,
      total: 120,
      limit: 20,
      offset: 40,
    });
  });

  it('supports empty results', () => {
    const pagination = new PaginationQueryDto();

    expect(createPaginated([], 0, pagination)).toEqual({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });
  });

  it('preserves total even when a page is empty', () => {
    const pagination = Object.assign(new PaginationQueryDto(), { offset: 500 });

    expect(createPaginated([], 120, pagination)).toEqual({
      items: [],
      total: 120,
      limit: 50,
      offset: 500,
    });
  });
});
