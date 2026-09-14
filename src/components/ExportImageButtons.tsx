import { useEffect, useRef, useState } from 'react'
import type { PlacedSession } from '../types'
import {
  canCopyImage,
  copyScheduleImage,
  downloadScheduleImage,
  type ScheduleImageEntry,
} from '../lib/exportImage'

interface Props {
  placed: PlacedSession[]
  entries: ScheduleImageEntry[]
  meta: string
  filename: string
  title?: string
}

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; text: string } | { kind: 'error'; text: string }

/** دکمه‌های «خروجی تصویر» — ذخیره‌ی PNG و کپی در کلیپ‌بورد */
export function ExportImageButtons({
  placed,
  entries,
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

  const run = async (action: 'save' | 'copy') => {
    setStatus({ kind: 'busy' })
    try {
      const input = { placed, entries, title, meta, scale: 2 }
      if (action === 'save') {
        await downloadScheduleImage(input, filename)
        flash({ kind: 'done', text: 'تصویر ذخیره شد' })
      } else {
        await copyScheduleImage(input)
        flash({ kind: 'done', text: 'در کلیپ‌بورد کپی شد' })
      }
    } catch {
      flash({
        kind: 'error',
        text: action === 'copy' ? 'کپی نشد؛ فایل را ذخیره کنید' : 'ساخت تصویر ناموفق بود',
      })
    }
  }

  const busy = status.kind === 'busy'
  const empty = placed.length === 0 && entries.length === 0

  return (
    <>
      <button
        type="button"
        className="btn btn--sm"
        onClick={() => void run('save')}
        disabled={busy || empty}
        title="ذخیره‌ی برنامه به‌صورت تصویر PNG"
      >
        {busy ? 'در حال ساخت…' : 'خروجی تصویر'}
      </button>

      {copyable && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => void run('copy')}
          disabled={busy || empty}
          title="کپی تصویر برنامه در کلیپ‌بورد"
        >
          کپی تصویر
        </button>
      )}

      {/* نتیجه، هم دیده شود هم برای صفحه‌خوان خوانده شود */}
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
