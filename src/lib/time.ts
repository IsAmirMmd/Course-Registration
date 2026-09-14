import { toFaDigits, toLatinDigits } from './digits'

/** "۰۸:۳۰" یا "8:30" → 510 دقیقه */
export function toMinutes(hhmm: string): number {
  const [h, m] = toLatinDigits(hhmm).split(':')
  return Number(h) * 60 + Number(m || '0')
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** نرمال‌سازی به "HH:MM" لاتین */
export function normalizeTime(hhmm: string): string {
  return fromMinutes(toMinutes(hhmm))
}

/** نمایش فارسی ساعت */
export function faTime(hhmm: string): string {
  return toFaDigits(normalizeTime(hhmm))
}

/**
 * دو بازه‌ی [aStart,aEnd) و [bStart,bEnd) روی هم می‌افتند؟
 * لبه‌ی مشترک (پایان یکی = شروع دیگری) تداخل حساب نمی‌شود.
 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * جدول دانشگاه ساعت را به هر دو ترتیب چاپ می‌کند (بسته به جهت‌دهی متن).
 * پس جفت را بی‌ترتیب می‌گیریم: کوچک‌تر = شروع، بزرگ‌تر = پایان.
 */
export function orderTimePair(a: string, b: string): { start: string; end: string } {
  const na = normalizeTime(a)
  const nb = normalizeTime(b)
  return toMinutes(na) <= toMinutes(nb) ? { start: na, end: nb } : { start: nb, end: na }
}
