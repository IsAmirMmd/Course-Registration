/// <reference types="vite/client" />

/**
 * متغیرهای محیطیِ بیلد. نمونه‌شان در `.env.example` است و مقدارِ واقعی در
 * `.env.local` (که در گیت نیست) نوشته می‌شود.
 *
 * ⚠️ هر چیزی که با `VITE_` شروع شود داخل بیلدِ سمتِ کلاینت می‌نشیند و برای
 * بازدیدکننده خواندنی است. اینجا «راز» نگه ندارید؛ فقط چیزی بگذارید که لو‌رفتنش
 * را پذیرفته‌اید.
 */
interface ImportMetaEnv {
  /** توکنِ باتِ تلگرام برای اطلاع‌رسانیِ ورود — قابلِ استخراج از بیلد */
  readonly VITE_TG_BOT_TOKEN?: string
  /** شناسه‌ی عددیِ کانال، مثل `-1002247521670` */
  readonly VITE_TG_CHAT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
