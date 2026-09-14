import { useEffect, useRef, useState } from 'react'
import type { Course, PlacedSession } from '../types'
import {
  canCopyImage,
  copyScheduleImage,
  downloadScheduleImage,
  type ScheduleImageEntry,
} from '../lib/exportImage'
import { allGroupCodes, downloadWorkbook } from '../lib/exportExcel'
import { copyText } from '../lib/clipboard'
import { toFaDigits } from '../lib/digits'

interface Props {
  placed: PlacedSession[]
  entries: ScheduleImageEntry[]
  /** کل درس‌های ارائه‌شده، برای برگه‌ی سومِ فایل اکسل */
  catalogue: Course[]
  meta: string
  filename: string
  title?: string
}

type Kind = 'image' | 'copyImage' | 'excel' | 'codes'
type Status = { kind: 'idle' } | { kind: 'busy'; what: Kind } | { kind: 'done'; text: string } | { kind: 'error'; text: string }

/** خروجی‌های برنامه: تصویر، اکسل، و کپی یک‌جای کدهای گروه */
export function ExportButtons({
  placed,
  entries,
  catalogue,
  meta,
  filename,
  title = 'برنامه‌ی هفتگی',
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const timer = useRef<number | undefined>(undefined)
  const copyable = canCopyImage()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flash = (next: Status) => {
    setStatus(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus({ kind: 'idle' }), 3500)
  }

  const run = async (what: Kind) => {
    setStatus({ kind: 'busy', what })
    try {
      if (what === 'image') {
        await downloadScheduleImage({ placed, entries, title, meta, scale: 2 }, filename)
        flash({ kind: 'done', text: 'تصویر ذخیره شد' })
      } else if (what === 'copyImage') {
        await copyScheduleImage({ placed, entries, title, meta, scale: 2 })
        flash({ kind: 'done', text: 'تصویر در کلیپ‌بورد کپی شد' })
      } else if (what === 'excel') {
        downloadWorkbook(
          { placed, entries, catalogue, title, meta },
          filename.replace(/\.png$/, '.xlsx'),
        )
        flash({ kind: 'done', text: 'فایل اکسل ذخیره شد' })
      } else {
        await copyText(allGroupCodes(entries))
        flash({ kind: 'done', text: `${toFaDigits(entries.length)} کد گروه کپی شد` })
      }
    } catch {
      const text =
        what === 'copyImage'
          ? 'کپی نشد؛ فایل تصویر را ذخیره کنید'
          : what === 'codes'
            ? 'کپی کدها ممکن نشد'
            : what === 'excel'
              ? 'ساخت فایل اکسل ناموفق بود'
              : 'ساخت تصویر ناموفق بود'
      flash({ kind: 'error', text })
    }
  }

  const busy = status.kind === 'busy'
  const empty = placed.length === 0 && entries.length === 0
  const label = (what: Kind, text: string) =>
    busy && status.kind === 'busy' && status.what === what ? 'در حال ساخت…' : text

  return (
    <>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => void run('codes')}
        disabled={busy || entries.length === 0}
        title="کپی کد همه‌ی گروه‌های این برنامه، هر کدام در یک خط"
      >
        کپی کدها
      </button>

      <button
        type="button"
        className="btn btn--sm"
        onClick={() => void run('excel')}
        disabled={busy || empty}
        title="خروجی xlsx: جدول هفتگی، درس‌های برنامه و کل درس‌های ارائه‌شده"
      >
        {label('excel', 'خروجی اکسل')}
      </button>

      <button
        type="button"
        className="btn btn--sm"
        onClick={() => void run('image')}
        disabled={busy || empty}
        title="ذخیره‌ی برنامه به‌صورت تصویر PNG"
      >
        {label('image', 'خروجی تصویر')}
      </button>

      {copyable && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => void run('copyImage')}
          disabled={busy || empty}
          title="کپی تصویر برنامه در کلیپ‌بورد"
        >
          کپی تصویر
        </button>
      )}

      {(status.kind === 'done' || status.kind === 'error') && (
        <span
          className={`chip ${status.kind === 'error' ? 'chip--danger' : 'chip--good'}`}
          role="status"
        >
          {status.text}
        </span>
      )}
    </>
  )
}
