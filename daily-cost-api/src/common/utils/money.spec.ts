import {
  MAX_DB_AMOUNT_MINOR,
  MoneyValidationError,
  addMinorUnits,
  assertMinorAmount,
  fromMinorUnits,
  toMinorUnits,
} from './money';

describe('Money utilities', () => {
  describe('assertMinorAmount', () => {
    it('accepts positive integer amounts', () => {
      expect(assertMinorAmount(100)).toBe(100);
    });

    it('accepts the maximum database amount', () => {
      expect(assertMinorAmount(MAX_DB_AMOUNT_MINOR)).toBe(MAX_DB_AMOUNT_MINOR);
    });

    it('rejects zero for transactions', () => {
      expect(() => assertMinorAmount(0)).toThrow(MoneyValidationError);
    });

    it('accepts zero when explicitly allowed', () => {
      expect(assertMinorAmount(0, { allowZero: true })).toBe(0);
    });

    it.each([-1, 1.5, NaN, Infinity, MAX_DB_AMOUNT_MINOR + 1])(
      'rejects invalid amount %p',
      (amount) => {
        expect(() => assertMinorAmount(amount)).toThrow(MoneyValidationError);
      },
    );
  });

  describe('toMinorUnits', () => {
    it.each([
      ['125.50', 2, 12550],
      ['125', 2, 12500],
      ['0.01', 2, 1],
      ['125', 0, 125],
      ['12.345', 3, 12345],
      ['12.5', 2, 1250],
    ])('converts %s correctly', (value, digits, expected) => {
      expect(toMinorUnits(value, digits)).toBe(expected);
    });

    it.each([
      ['12.345', 2],
      ['-5', 2],
      ['abc', 2],
      ['12,50', 2],
      ['1e3', 2],
      ['1.5', 0],
    ])('rejects %s with precision %i', (value, digits) => {
      expect(() => toMinorUnits(value, digits)).toThrow(MoneyValidationError);
    });

    it('rejects database overflow', () => {
      expect(() => toMinorUnits('21474836.48', 2)).toThrow(
        MoneyValidationError,
      );
    });

    it('accepts the exact database maximum', () => {
      expect(toMinorUnits('21474836.47', 2)).toBe(MAX_DB_AMOUNT_MINOR);
    });
  });

  describe('fromMinorUnits', () => {
    it('formats positive amounts', () => {
      expect(fromMinorUnits(12550, 2)).toBe('125.50');
    });

    it('formats zero', () => {
      expect(fromMinorUnits(0, 2)).toBe('0.00');
    });

    it('formats negative balances', () => {
      expect(fromMinorUnits(-12550, 2)).toBe('-125.50');
    });

    it('supports zero decimal currencies', () => {
      expect(fromMinorUnits(125, 0)).toBe('125');
    });
  });

  describe('addMinorUnits', () => {
    it('adds signed amounts', () => {
      expect(addMinorUnits(10000, 5000, -3000)).toBe(12000);
    });

    it('allows negative calculated balances', () => {
      expect(addMinorUnits(1000, -2000)).toBe(-1000);
    });

    it('rejects unsafe totals', () => {
      expect(() => addMinorUnits(Number.MAX_SAFE_INTEGER, 1)).toThrow(
        MoneyValidationError,
      );
    });
  });
});
