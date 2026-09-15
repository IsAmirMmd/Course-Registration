import { toFaDigits } from './digits'
import { fullName, type Identity } from './identity'

/**
 * اطلاع‌رسانیِ ورود به یک کانال تلگرام.
 *
 * ⚠️ این اپ بک‌اند ندارد، پس توکنِ بات ناچار داخل بیلد قرار می‌گیرد و هر کسی که
 * صفحه را باز کند می‌تواند آن را بخواند و با بات پیام بفرستد. توکن از متغیرهای
 * محیطی خوانده می‌شود تا دست‌کم در مخزن گیت نباشد، ولی این «مخفی‌سازی» نیست.
 * راهِ درست، یک اندپوینتِ کوچکِ سمت سرور است که خودش توکن را نگه دارد و این اپ
 * فقط او را صدا بزند (نگاه کنید به README، بخشِ «اطلاع‌رسانی ورود»).
 */
export interface TelegramConfig {
  token: string
  chatId: string
}

export function telegramConfig(): TelegramConfig | null {
  const token = import.meta.env.VITE_TG_BOT_TOKEN?.trim()
  const chatId = import.meta.env.VITE_TG_CHAT_ID?.trim()
  if (!token || !chatId) return null
  return { token, chatId }
}

/* ────────────────────────────── ساختِ متنِ پیام ────────────────────────────── */

/** تلگرام با parse_mode=HTML فقط همین سه نویسه را باید escape‌شده ببیند */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * تاریخِ شمسی به ترتیبِ «سه‌شنبه ۲۴ شهریور ۱۴۰۵».
 * `format()` خودش ترتیبِ دیگری می‌دهد («۱۴۰۵ شهریور ۲۴, سه‌شنبه») و یک ویرگولِ
 * بی‌جا هم وسطش می‌گذارد، پس اجزا را خودمان می‌چینیم.
 */
export function faDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  try {
    const parts = new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(d)
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? ''
    const date = [get('weekday'), get('day'), get('month'), get('year')].filter(Boolean).join(' ')
    const time = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return { date: date || iso.slice(0, 10), time }
  } catch {
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
  }
}

/** برچسبِ ساده‌ی دستگاه — فقط برای اینکه بدانید ورود از کجا بوده */
export function deviceLabel(userAgent: string): string {
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : 'مرورگر ناشناس'
  const os =
    /Android/.test(userAgent) ? 'اندروید'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS'
    : /Windows/.test(userAgent) ? 'ویندوز'
    : /Mac OS X/.test(userAgent) ? 'مک'
    : /Linux/.test(userAgent) ? 'لینوکس'
    : 'سیستم ناشناس'
  return `${browser} روی ${os}`
}

export interface SignInMeta {
  userAgent: string
  /** تعداد درس‌های کاتالوگ و گروه‌ها — برای اینکه بدانید با چه داده‌ای کار می‌کند */
  courseCount: number
  groupCount: number
  /** چندمین ورود با همین نام است */
  visit: number
}

export function buildSignInMessage(identity: Identity, meta: SignInMeta): string {
  const { date, time } = faDateTime(identity.signedInAt)
  const name = escapeHtml(fullName(identity))
  const lines = [
    '🎓 <b>ورود تازه به برنامه‌ریز هفتگی انتخاب واحد</b>',
    '',
    `👤 <b>نام و نام خانوادگی:</b> ${name}`,
    `📅 <b>تاریخ:</b> ${escapeHtml(date)}`,
    `⏰ <b>ساعت:</b> ${escapeHtml(time)}`,
    `💻 <b>دستگاه:</b> ${escapeHtml(deviceLabel(meta.userAgent))}`,
    `📚 <b>داده‌ی درس‌ها:</b> ${toFaDigits(meta.courseCount)} درس · ${toFaDigits(meta.groupCount)} گروه`,
    meta.visit > 1
      ? `🔁 <b>ورودِ شماره:</b> ${toFaDigits(meta.visit)} با همین نام`
      : '🆕 <b>اولین ورود</b> با این نام',
    '',
    '✅ کاربر وارد شد و می‌تواند برنامه‌ی هفتگی‌اش را بچیند.',
  ]
  return lines.join('\n')
}

/* ─────────────────────────────── فرستادنِ پیام ─────────────────────────────── */

export interface SendResult {
  ok: boolean
  /** توضیحِ فارسیِ خطا، برای نشان‌دادن به کاربر */
  error?: string
}

export async function sendTelegram(
  cfg: TelegramConfig,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const url = `https://api.telegram.org/bot${cfg.token}/sendMessage`
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    const data = (await res.json()) as { ok?: boolean; description?: string }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description ?? `پاسخِ ${res.status} از تلگرام` }
    }
    return { ok: true }
  } catch {
    // تلگرام در ایران فیلتر است؛ بدون VPN همین شاخه اجرا می‌شود.
    return { ok: false, error: 'به تلگرام وصل نشد (شبکه یا فیلترینگ)' }
  }
}

/* ───────────────────── صفِ پیام‌های نرسیده ───────────────────── */

const QUEUE_KEY = 'scheduleplanner.notify.queue.v1'
/** بیشتر از این نگه نمی‌داریم؛ اطلاع‌رسانیِ ورود، لاگِ دائمی نیست */
const QUEUE_MAX = 20

export interface PendingNotice {
  id: string
  text: string
  queuedAt: string
}

export function loadQueue(): PendingNotice[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return sanitizeQueue(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveQueue(queue: PendingNotice[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-QUEUE_MAX)))
  } catch {
    /* حافظه پر است — اطلاع‌رسانی نباید جلوی کارِ کاربر را بگیرد */
  }
}

export function sanitizeQueue(input: unknown): PendingNotice[] {
  if (!Array.isArray(input)) return []
  const out: PendingNotice[] = []
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue
    const { id, text, queuedAt } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof text !== 'string' || !text) continue
    out.push({ id, text, queuedAt: typeof queuedAt === 'string' ? queuedAt : '' })
  }
  return out.slice(-QUEUE_MAX)
}

export function enqueue(text: string): PendingNotice[] {
  const notice: PendingNotice = {
    id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    text,
    queuedAt: new Date().toISOString(),
  }
  const queue = [...loadQueue(), notice]
  saveQueue(queue)
  return queue
}

/** جلوگیری از دو خالی‌کردنِ هم‌زمانِ صف در یک تب */
let flushing = false

/**
 * هر چه در صف مانده را می‌فرستد و آن‌هایی که رفتند را برمی‌دارد. اگر فرستادنِ
 * یکی شکست خورد، همان و بقیه سر جایشان می‌مانند تا بارِ بعد.
 *
 * هر پیام **پیش از** فرستادن از صف برداشته می‌شود و در صورت شکست برمی‌گردد.
 * ترتیبِ عکسش (اول بفرست، بعد بردار) یعنی دو اجرای هم‌زمان — که StrictMode در
 * حالت توسعه واقعاً تولید می‌کند — یک پیام را دو بار به کانال می‌فرستند.
 */
export async function flushQueue(
  cfg: TelegramConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ sent: number; left: number }> {
  if (flushing) return { sent: 0, left: loadQueue().length }
  flushing = true
  let sent = 0
  try {
    for (;;) {
      const queue = loadQueue()
      if (queue.length === 0) return { sent, left: 0 }
      const [head, ...rest] = queue
      saveQueue(rest)
      const result = await sendTelegram(cfg, head.text, fetchImpl)
      if (!result.ok) {
        // سرِ صف برگردد — در این فاصله ممکن است پیامِ تازه‌ای هم اضافه شده باشد
        saveQueue([head, ...loadQueue()])
        return { sent, left: loadQueue().length }
      }
      sent++
    }
  } finally {
    flushing = false
  }
}
