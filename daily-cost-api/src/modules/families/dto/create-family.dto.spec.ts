import { ArgumentMetadata } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-codes';
import { createValidationPipe } from '../../../common/pipes/app-validation.pipe';
import { CreateFamilyDto } from './create-family.dto';

const metadata: ArgumentMetadata = { type: 'body', metatype: CreateFamilyDto };
const pipe = createValidationPipe();

describe('CreateFamilyDto', () => {
  it('trims the name and accepts a valid currency and calendar', async () => {
    await expect(
      pipe.transform(
        { name: '  Family  ', currency: 'USD', calendar: 'GREGORIAN' },
        metadata,
      ),
    ).resolves.toMatchObject({
      name: 'Family',
      currency: 'USD',
      calendar: 'GREGORIAN',
    });
  });

  it.each([
    { name: undefined },
    { name: null },
    { name: 123 },
    { name: '  ' },
    { name: 'x'.repeat(101) },
    { currency: 'ZZZ' },
    { currency: 'usd' },
    { currency: null },
    { calendar: 'INVALID' },
    { calendar: null },
    { ownerId: 'other' },
    { userId: 'other' },
    { status: 'ACTIVE' },
  ])('rejects invalid family input %j', async (fields) => {
    await expect(
      pipe.transform({ name: 'Family', ...fields }, metadata),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });
});
