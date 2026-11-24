import { AppException } from '../../../common/exceptions/app.exception';
import { createValidationPipe } from '../../../common/pipes/app-validation.pipe';
import { RegisterDto } from './register.dto';

const valid = {
  fullName: 'Ali Ahmadi',
  email: 'ali@example.com',
  password: 'correct horse',
};

const run = (body: unknown) =>
  createValidationPipe().transform(body, {
    type: 'body',
    metatype: RegisterDto,
  });

async function failure(body: unknown): Promise<AppException> {
  try {
    await run(body);
  } catch (e) {
    return e as AppException;
  }
  throw new Error('expected validation to fail');
}

const fields = (e: AppException) =>
  (e.details as { field: string }[]).map((d) => d.field);

describe('RegisterDto', () => {
  it('accepts a valid body and normalizes email and name', async () => {
    const dto = (await run({
      ...valid,
      fullName: '  Ali Ahmadi ',
      email: '  Ali@Example.COM ',
    })) as RegisterDto;
    expect(dto.email).toBe('ali@example.com');
    expect(dto.fullName).toBe('Ali Ahmadi');
  });

  it('does not alter the password', async () => {
    const dto = (await run({
      ...valid,
      password: '  spaces kept  ',
    })) as RegisterDto;
    expect(dto.password).toBe('  spaces kept  ');
  });

  it('rejects an invalid email', async () => {
    expect(fields(await failure({ ...valid, email: 'not-an-email' }))).toEqual([
      'email',
    ]);
  });

  it('rejects passwords shorter than 8 or longer than 128 characters', async () => {
    expect(fields(await failure({ ...valid, password: '1234567' }))).toEqual([
      'password',
    ]);
    expect(
      fields(await failure({ ...valid, password: 'x'.repeat(129) })),
    ).toEqual(['password']);
  });

  it('rejects a phone number or other unknown fields', async () => {
    expect(fields(await failure({ ...valid, phone: '+93700123456' }))).toEqual([
      'phone',
    ]);
  });

  it('rejects an unsupported language', async () => {
    expect(fields(await failure({ ...valid, language: 'de' }))).toEqual([
      'language',
    ]);
  });

  it('reports every missing field', async () => {
    expect(fields(await failure({})).sort()).toEqual([
      'email',
      'fullName',
      'password',
    ]);
  });
});
