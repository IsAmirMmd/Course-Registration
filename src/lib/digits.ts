const FA = '۰۱۲۳۴۵۶۷۸۹'
const AR = '٠١٢٣٤٥٦٧٨٩'

/** ارقام فارسی/عربی → لاتین (برای محاسبه) */
export function toLatinDigits(input: string): string {
  let out = ''
  for (const ch of input) {
    const fa = FA.indexOf(ch)
    if (fa >= 0) {
      out += String(fa)
      continue
    }
    const ar = AR.indexOf(ch)
    out += ar >= 0 ? String(ar) : ch
  }
  return out
}

/** ارقام لاتین → فارسی (برای نمایش) */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA[Number(d)])
}

/** فاصله‌ی مجازی و نشانه‌های جهت‌دهی که در متن کپی‌شده از سیستم دانشگاه فراوان‌اند */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g
const DIACRITICS = /[\u064B-\u0652\u0640]/g
const NBSP = /[\u00A0\u2000-\u200A\u3000]/g
/** همان نامرئی‌ها، ولی بدونِ نیم‌فاصله (U+200C) */
const INVISIBLE_KEEP_ZWNJ = /[\u200B\u200D-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g

/**
 * نرمال‌سازی متن فارسی برای «مقایسه» (نه نمایش):
 * یکسان‌سازی ی/ک عربی، حذف اعراب، حذف نویسه‌های نامرئی و فشرده‌کردن فاصله‌ها.
 */
export function normalizeFa(input: string): string {
  return input
    .replace(/ي/g, 'ی') // ي → ی
    .replace(/ى/g, 'ی') // ى → ی
    .replace(/ك/g, 'ک') // ك → ک
    .replace(DIACRITICS, '') // اعراب و کشیده
    .replace(INVISIBLE, '')
    .replace(NBSP, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * پاک‌سازی متنی که «نمایش» داده می‌شود: نویسه‌های نامرئی و
 * فاصله‌های غیرمعمول می‌روند، ولی نیم‌فاصله می‌ماند (در «علی‌رضا»
 * معنا دارد) و ی/ک عربی هم دست‌نخورده می‌ماند.
 */
export function tidyText(input: string): string {
  return input.replace(INVISIBLE_KEEP_ZWNJ, '').replace(NBSP, ' ').replace(/\s+/g, ' ').trim()
}
