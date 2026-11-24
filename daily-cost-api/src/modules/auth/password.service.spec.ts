import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  beforeAll(() => service.onModuleInit());

  it('hashes with argon2id and never contains the password', async () => {
    const hash = await service.hash('s3cret-pass');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('s3cret-pass');
  });

  it('uses a new salt every time', async () => {
    expect(await service.hash('same')).not.toBe(await service.hash('same'));
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await service.hash('right-password');
    expect(await service.verify(hash, 'right-password')).toBe(true);
    expect(await service.verify(hash, 'wrong-password')).toBe(false);
  });

  it('returns false without a hash (unknown account)', async () => {
    expect(await service.verify(null, 'anything')).toBe(false);
    expect(await service.verify(undefined, 'anything')).toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await service.verify('not-a-hash', 'anything')).toBe(false);
  });
});
