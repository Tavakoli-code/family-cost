import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { AppException } from '../exceptions/app.exception';
import { createValidationPipe } from './app-validation.pipe';

class LineDto {
  @IsString()
  @MinLength(2)
  name: string;
}

class CreateDto {
  @IsInt()
  @Min(1)
  amountMinor: number;

  @ValidateNested()
  @Type(() => LineDto)
  line: LineDto;

  @ValidateNested({ each: true })
  @Type(() => LineDto)
  lines: LineDto[];
}

async function validate(value: unknown): Promise<AppException> {
  try {
    await createValidationPipe().transform(value, {
      type: 'body',
      metatype: CreateDto,
    });
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected validation to fail');
}

describe('validation pipe', () => {
  const valid = { amountMinor: 5, line: { name: 'ok' }, lines: [{ name: 'ok' }] };

  it('returns VALIDATION_FAILED with status 400', async () => {
    const error = await validate({ ...valid, amountMinor: 0 });
    expect(error).toBeInstanceOf(AppException);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.getStatus()).toBe(400);
  });

  it('reports each failing field with its rule', async () => {
    const error = await validate({ ...valid, amountMinor: 0 });
    expect(error.details).toEqual([
      {
        field: 'amountMinor',
        issues: [{ rule: 'min', message: expect.any(String) }],
      },
    ]);
  });

  it('uses dotted paths for nested objects and array items', async () => {
    const error = await validate({
      ...valid,
      line: { name: 'x' },
      lines: [{ name: 'ok' }, { name: '' }],
    });
    const fields = (error.details as { field: string }[]).map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['line.name', 'lines.1.name']));
  });

  it('rejects unknown properties', async () => {
    const error = await validate({ ...valid, hack: true });
    expect(error.details).toEqual([
      {
        field: 'hack',
        issues: [{ rule: 'whitelistValidation', message: expect.any(String) }],
      },
    ]);
  });

  it('accepts valid input and returns a DTO instance', async () => {
    const result = await createValidationPipe().transform(valid, {
      type: 'body',
      metatype: CreateDto,
    });
    expect(result).toBeInstanceOf(CreateDto);
    expect(result.amountMinor).toBe(5);
  });
});