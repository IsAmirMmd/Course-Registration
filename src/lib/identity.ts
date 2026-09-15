import { normalizeFa, tidyText } from './digits'

/**
 * هویتِ کاربر — نام و نام خانوادگی که خودش انتخاب می‌کند. تا وقتی این در
 * localStorage نباشد، اپ قفل است. هیچ چیزِ دیگری (شماره دانشجویی، ایمیل، …)
 * پرسیده و ذخیره نمی‌شود.
 */
export interface Identity {
  firstName: string
  lastName: string
  /** ISO 8601 — لحظه‌ی ثبتِ نام */
  signedInAt: string
}

const KEY = 'scheduleplanner.identity.v1'

export function fullName(identity: Identity): string {
  return `${identity.firstName} ${identity.lastName}`.trim()
}

/* ─────────────────────────────── اعتبارسنجی ─────────────────────────────── */

export const NAME_MAX = 40

/**
 * حروفِ مجاز: فارسی/عربی، لاتین، فاصله، نیم‌فاصله و خط تیره.
 * رقم و نشانه‌گذاری اجازه ندارد — «نام» است، نه شناسه.
 */
// نیم‌فاصله را با \u200C می‌نویسیم تا در کد دیده شود؛ نویسه‌ی نامرئیی که در متنِ
// رگولار پنهان باشد، بازبینی‌ناپذیر است.
const NAME_OK =
  /^[ء-غف-يٮ-ۓa-zA-Z][ء-غف-يٮ-ۓ\u200Ca-zA-Z '’-]*$/u

export type NameField = 'firstName' | 'lastName'

/** پیامِ خطا برای یک فیلد، یا null اگر درست است */
export function validateName(raw: string, field: NameField): string | null {
  const label = field === 'firstName' ? 'نام' : 'نام خانوادگی'
  const value = cleanName(raw)
  if (!value) return `${label} را وارد کنید.`
  if (value.length < 2) return `${label} باید دست‌کم ۲ نویسه باشد.`
  if (value.length > NAME_MAX) return `${label} خیلی بلند است (حداکثر ۴۰ نویسه).`
  if (/[0-9۰-۹٠-٩]/.test(value)) return `${label} نمی‌تواند رقم داشته باشد.`
  if (!NAME_OK.test(value)) return `${label} فقط می‌تواند حرف، فاصله و خط تیره داشته باشد.`
  return null
}

/** فاصله‌های اضافی و نویسه‌های نامرئی را می‌گیرد، ولی ی/ک را دست نمی‌زند */
export function cleanName(raw: string): string {
  return tidyText(raw)
}

export function makeIdentity(firstName: string, lastName: string): Identity {
  return {
    firstName: cleanName(firstName),
    lastName: cleanName(lastName),
    signedInAt: new Date().toISOString(),
  }
}

/** برای تشخیصِ «همین شخص است یا کسِ دیگری» — با ی/ک یکسان‌شده */
export function identityKey(identity: Identity): string {
  return normalizeFa(`${identity.firstName}|${identity.lastName}`).toLowerCase()
}

/* ─────────────────────────── خواندن و نوشتنِ حافظه ─────────────────────────── */

export function loadIdentity(): Identity | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // پنجره‌ی ناشناس یا دسترسیِ بسته — کاربر قفل می‌ماند، که همان رفتار خواسته‌شده است
    return null
  }
  if (!raw) return null
  try {
    return sanitizeIdentity(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveIdentity(identity: Identity): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity))
    return true
  } catch {
    return false
  }
}

export function clearIdentity(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* چیزی برای پاک‌کردن نبود */
  }
}

/**
 * حافظه ممکن است دست‌کاری‌شده باشد. یک نامِ نامعتبر نباید در قفل را باز کند،
 * پس همان اعتبارسنجیِ فرم اینجا هم اجرا می‌شود.
 */
export function sanitizeIdentity(input: unknown): Identity | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const { firstName, lastName, signedInAt } = input as Record<string, unknown>
  if (typeof firstName !== 'string' || typeof lastName !== 'string') return null
  if (validateName(firstName, 'firstName') || validateName(lastName, 'lastName')) return null
  return {
    firstName: cleanName(firstName),
    lastName: cleanName(lastName),
    signedInAt: typeof signedInAt === 'string' ? signedInAt : new Date().toISOString(),
  }
}
