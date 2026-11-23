import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  PaginationQueryDto,
} from './pagination-query.dto';

function validate(query: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, query);
  return {
    dto,
    errors: validateSync(dto),
  };
}

describe('PaginationQueryDto', () => {
  it('uses defaults when parameters are missing', () => {
    const { dto, errors } = validate({});

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(dto.offset).toBe(0);
  });

  it('converts query strings into numbers', () => {
    const { dto, errors } = validate({
      limit: '20',
      offset: '40',
    });

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(40);
  });

  it('accepts the maximum limit', () => {
    const { dto, errors } = validate({
      limit: String(MAX_PAGE_LIMIT),
    });

    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(200);
  });

  it('accepts offset zero', () => {
    const { errors } = validate({ offset: '0' });
    expect(errors).toHaveLength(0);
  });

  it.each(['0', '-1', '201', 'abc', '10.5', '', ' ', '1e2'])(
    'rejects invalid limit %p',
    (limit) => {
      const { errors } = validate({ limit });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    },
  );

  it.each(['-1', 'abc', '1.5', '', ' '])(
    'rejects invalid offset %p',
    (offset) => {
      const { errors } = validate({ offset });
      expect(errors.some((e) => e.property === 'offset')).toBe(true);
    },
  );

  it('rejects repeated query parameters', () => {
    const { errors } = validate({
      limit: ['10', '20'],
    });

    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('reports both invalid fields', () => {
    const { errors } = validate({
      limit: '500',
      offset: '-10',
    });

    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['limit', 'offset']),
    );
  });
});
