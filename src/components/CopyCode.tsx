import { useEffect, useRef, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { toFaDigits } from '../lib/digits'

interface Props {
  /** مقداری که کپی می‌شود — با ارقام لاتین، همان چیزی که در سیستم آموزش تایپ می‌شود */
  value: string
  /** برچسبِ کوتاه پیش از کد، مثل «کد» یا «گروه» */
  label?: string
  title?: string
}

/**
 * کدِ درس/گروه به‌صورت دکمه: یک کلیک، کپی در کلیپ‌بورد.
 * نمایش با ارقام فارسی است اما آنچه کپی می‌شود ارقام لاتینِ اصلی است، چون
 * همان را باید در سیستم انتخاب‌واحد وارد کرد.
 */
export function CopyCode({ value, label, title }: Props) {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onClick = async (event: React.MouseEvent) => {
    // در فهرست درس‌ها این دکمه داخل ردیفِ قابل‌انتخاب است
    event.preventDefault()
    event.stopPropagation()
    try {
      await copyText(value)
      setState('done')
    } catch {
      setState('error')
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1600)
  }

  return (
    <button
      type="button"
      className={`code-copy${state === 'done' ? ' is-done' : ''}${state === 'error' ? ' is-error' : ''}`}
      onClick={(e) => void onClick(e)}
      title={title ?? `کپی ${value}`}
      aria-label={`کپی ${label ? `${label} ` : ''}${value}`}
    >
      {label && <span className="code-copy__label">{label}</span>}
      <span className="code-copy__value num">{toFaDigits(value)}</span>
      <span className="code-copy__icon" aria-hidden="true">
        {state === 'done' ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.3 4.6 9 10 3.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1.4" y="1.4" width="6.4" height="6.4" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4.2 10.6h4.4a2 2 0 0 0 2-2V4.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {/* برای صفحه‌خوان: نتیجه اعلام شود */}
      <span className="sr-only" role="status">
        {state === 'done' ? 'کپی شد' : state === 'error' ? 'کپی نشد' : ''}
      </span>
    </button>
  )
}
