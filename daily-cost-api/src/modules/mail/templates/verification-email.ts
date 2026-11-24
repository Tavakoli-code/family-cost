export interface VerificationEmailInput {
  code: string;
  language: string;
  ttlMinutes: number;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

interface Copy {
  subject: string;
  intro: string;
  expires: (minutes: number) => string;
  ignore: string;
}

const COPY: Record<'en' | 'fa' | 'ps', Copy> = {
  en: {
    subject: 'Your Daily Cost verification code',
    intro: 'Use this code to verify your email address:',
    expires: (m) => `The code expires in ${m} minutes.`,
    ignore: 'If you did not create an account, you can ignore this email.',
  },
  fa: {
    subject: 'کد تأیید ایمیل شما در Daily Cost',
    intro: 'برای تأیید ایمیل خود این کد را وارد کنید:',
    expires: (m) => `این کد تا ${m} دقیقه معتبر است.`,
    ignore: 'اگر شما حساب نساخته‌اید، این ایمیل را نادیده بگیرید.',
  },
  ps: {
    subject: 'ستاسو د Daily Cost د بریښنالیک تایید کوډ',
    intro: 'د خپل بریښنالیک د تایید لپاره دا کوډ دننه کړئ:',
    expires: (m) => `دا کوډ تر ${m} دقیقو پورې اعتبار لري.`,
    ignore: 'که تاسو حساب نه دی جوړ کړی، دا بریښنالیک له پامه غورځوئ.',
  },
};

export function buildVerificationEmail({
  code,
  language,
  ttlMinutes,
}: VerificationEmailInput): BuiltEmail {
  const key = language === 'fa' || language === 'ps' ? language : 'en';
  const copy = COPY[key];
  const dir = key === 'en' ? 'ltr' : 'rtl';

  const text = [
    copy.intro,
    '',
    code,
    '',
    copy.expires(ttlMinutes),
    copy.ignore,
  ].join('\n');

  const html =
    `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;line-height:1.6">` +
    `<p>${copy.intro}</p>` +
    `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;direction:ltr;text-align:center">${code}</p>` +
    `<p>${copy.expires(ttlMinutes)}</p>` +
    `<p style="color:#666">${copy.ignore}</p>` +
    `</div>`;

  return { subject: copy.subject, text, html };
}
