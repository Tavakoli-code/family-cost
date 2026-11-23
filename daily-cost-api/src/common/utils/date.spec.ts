import {
  DateValidationError,
  createOptionalUtcDateRange,
  createUtcDateRange,
  parseUtcDateTime,
} from './date';

describe('UTC date utilities', () => {
  describe('parseUtcDateTime', () => {
    it('parses a valid UTC timestamp', () => {
      expect(parseUtcDateTime('2026-11-23T10:30:00Z').toISOString()).toBe(
        '2026-11-23T10:30:00.000Z',
      );
    });

    it('preserves milliseconds', () => {
      expect(parseUtcDateTime('2026-11-23T10:30:00.125Z').toISOString()).toBe(
        '2026-11-23T10:30:00.125Z',
      );
    });

    it('accepts a valid leap day', () => {
      expect(parseUtcDateTime('2024-02-29T00:00:00Z').toISOString()).toBe(
        '2024-02-29T00:00:00.000Z',
      );
    });

    it.each([
      '2026-02-29T00:00:00Z',
      '2026-02-30T00:00:00Z',
      '2026-13-01T00:00:00Z',
      '2026-01-01T24:00:00Z',
      '2026-01-01T10:60:00Z',
      '2026-11-23',
      '2026-11-23T10:30:00',
      'not-a-date',
      '',
    ])('rejects invalid date %p', (value) => {
      expect(() => parseUtcDateTime(value)).toThrow(DateValidationError);
    });
  });

  describe('createUtcDateRange', () => {
    it('creates inclusive and exclusive bounds', () => {
      const range = createUtcDateRange(
        '2026-11-01T00:00:00Z',
        '2026-12-01T00:00:00Z',
      );

      expect(range.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');

      expect(range.lt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });

    it('rejects reversed dates', () => {
      expect(() =>
        createUtcDateRange('2026-12-01T00:00:00Z', '2026-11-01T00:00:00Z'),
      ).toThrow(DateValidationError);
    });

    it('rejects equal boundaries', () => {
      expect(() =>
        createUtcDateRange('2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'),
      ).toThrow(DateValidationError);
    });
  });

  describe('createOptionalUtcDateRange', () => {
    it('returns empty bounds when unspecified', () => {
      expect(createOptionalUtcDateRange()).toEqual({});
    });

    it('supports a start-only filter', () => {
      const range = createOptionalUtcDateRange('2026-11-01T00:00:00Z');

      expect(range.gte).toBeInstanceOf(Date);
      expect(range.lt).toBeUndefined();
    });

    it('supports an end-only filter', () => {
      const range = createOptionalUtcDateRange(
        undefined,
        '2026-12-01T00:00:00Z',
      );

      expect(range.gte).toBeUndefined();
      expect(range.lt).toBeInstanceOf(Date);
    });

    it('rejects an empty start bound', () => {
      expect(() => createOptionalUtcDateRange('')).toThrow(DateValidationError);
    });
  });
});
