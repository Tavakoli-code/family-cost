import { buildVerificationEmail } from './verification-email';

describe('buildVerificationEmail', () => {
  const build = (language: string) =>
    buildVerificationEmail({ code: '482913', language, ttlMinutes: 15 });

  it.each(['en', 'fa', 'ps'])(
    'includes the code and the lifetime (%s)',
    (language) => {
      const mail = build(language);
      expect(mail.text).toContain('482913');
      expect(mail.html).toContain('482913');
      expect(mail.text).toContain('15');
      expect(mail.subject.length).toBeGreaterThan(5);
    },
  );

  it('writes Dari and Pashto right-to-left and English left-to-right', () => {
    expect(build('fa').html).toContain('dir="rtl"');
    expect(build('ps').html).toContain('dir="rtl"');
    expect(build('en').html).toContain('dir="ltr"');
  });

  it('uses a different subject for each language', () => {
    const subjects = new Set(['en', 'fa', 'ps'].map((l) => build(l).subject));
    expect(subjects.size).toBe(3);
  });

  it('falls back to English for an unknown language', () => {
    expect(build('de').subject).toBe(build('en').subject);
  });

  it('keeps the code left-to-right inside right-to-left emails', () => {
    expect(build('fa').html).toContain('direction:ltr');
  });
});
