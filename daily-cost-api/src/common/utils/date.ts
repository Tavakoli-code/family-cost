export class DateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateValidationError';
  }
}

export interface UtcDateRange {
  gte: Date;
  lt: Date;
}

export interface OptionalUtcDateRange {
  gte?: Date;
  lt?: Date;
}

const UTC_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

export function parseUtcDateTime(value: string): Date {
  if (typeof value !== 'string') {
    throw new DateValidationError('Date must be a UTC ISO timestamp');
  }

  const match = UTC_TIMESTAMP.exec(value);

  if (!match) {
    throw new DateValidationError(
      'Date must use ISO 8601 UTC format ending in Z',
    );
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    fractionText = '0',
  ] = match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.padEnd(3, '0'));

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) {
    throw new DateValidationError('Invalid UTC calendar date or time');
  }

  return date;
}

export function createUtcDateRange(from: string, to: string): UtcDateRange {
  const gte = parseUtcDateTime(from);
  const lt = parseUtcDateTime(to);

  if (gte.getTime() >= lt.getTime()) {
    throw new DateValidationError('from must be earlier than to');
  }

  return { gte, lt };
}

export function createOptionalUtcDateRange(
  from?: string,
  to?: string,
): OptionalUtcDateRange {
  if (from === undefined && to === undefined) {
    return {};
  }

  if (from !== undefined && to !== undefined) {
    return createUtcDateRange(from, to);
  }

  return from !== undefined
    ? { gte: parseUtcDateTime(from) }
    : { lt: parseUtcDateTime(to!) };
}
