import type { ReactNode } from 'react'
import { toFaDigits } from '../lib/digits'

export function Tick({ on }: { on: boolean }) {
  return (
    <span className={`tick${on ? ' is-on' : ''}`} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2 6.4 4.6 9 10 3.2"
          stroke="var(--primary-ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{
        transform: `rotate(${open ? 180 : 0}deg)`,
        transition: 'transform var(--dur) var(--ease)',
      }}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CreditMeter({ credits, label = 'واحد انتخاب‌شده' }: { credits: number; label?: string }) {
  return (
    <div className="credit-meter" title={label}>
      <span className="credit-meter__num">{toFaDigits(credits)}</span>
      <span className="credit-meter__label">{label}</span>
    </div>
  )
}

export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`collapse${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  )
}

export function Notice({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'warn' | 'danger'
  children: ReactNode
}) {
  return <div className={`notice notice--${kind}`}>{children}</div>
}
