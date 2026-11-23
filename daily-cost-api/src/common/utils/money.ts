export const MAX_DB_AMOUNT_MINOR = 2_147_483_647;
export const MIN_DB_AMOUNT_MINOR = 0;

export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyValidationError';
  }
}

export function assertMinorAmount(
  amount: number,
  options: { allowZero?: boolean } = {},
): number {
  const minimum = options.allowZero ? 0 : 1;

  if (
    !Number.isSafeInteger(amount) ||
    amount < minimum ||
    amount > MAX_DB_AMOUNT_MINOR
  ) {
    throw new MoneyValidationError(
      `Amount must be an integer between ` +
        `${minimum} and ${MAX_DB_AMOUNT_MINOR} minor units`,
    );
  }

  return amount;
}

export function toMinorUnits(value: string, fractionDigits: number): number {
  assertFractionDigits(fractionDigits);

  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new MoneyValidationError(
      'Money must be a non-negative decimal string',
    );
  }

  const [whole, fraction = ''] = value.split('.');

  if (fraction.length > fractionDigits) {
    throw new MoneyValidationError(
      `Money supports at most ${fractionDigits} decimal places`,
    );
  }

  const factor = 10n ** BigInt(fractionDigits);
  const paddedFraction = fraction.padEnd(fractionDigits, '0');

  const minor = BigInt(whole) * factor + BigInt(paddedFraction || '0');

  if (minor > BigInt(MAX_DB_AMOUNT_MINOR)) {
    throw new MoneyValidationError('Amount exceeds database storage limit');
  }

  return Number(minor);
}

export function fromMinorUnits(amount: number, fractionDigits: number): string {
  assertFractionDigits(fractionDigits);

  if (!Number.isSafeInteger(amount)) {
    throw new MoneyValidationError('Amount must be a safe integer');
  }

  const negative = amount < 0;
  const absolute = BigInt(Math.abs(amount));
  const factor = 10n ** BigInt(fractionDigits);

  const whole = absolute / factor;
  const fraction = absolute % factor;

  const decimal =
    fractionDigits === 0
      ? whole.toString()
      : `${whole}.${fraction.toString().padStart(fractionDigits, '0')}`;

  return negative ? `-${decimal}` : decimal;
}

export function addMinorUnits(...amounts: number[]): number {
  let total = 0n;

  for (const amount of amounts) {
    if (!Number.isSafeInteger(amount)) {
      throw new MoneyValidationError('Every amount must be a safe integer');
    }

    total += BigInt(amount);
  }

  if (
    total > BigInt(Number.MAX_SAFE_INTEGER) ||
    total < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new MoneyValidationError(
      'Calculated total exceeds the safe integer range',
    );
  }

  return Number(total);
}

function assertFractionDigits(fractionDigits: number): void {
  if (
    !Number.isInteger(fractionDigits) ||
    fractionDigits < 0 ||
    fractionDigits > 3
  ) {
    throw new MoneyValidationError(
      'Currency fraction digits must be between 0 and 3',
    );
  }
}
