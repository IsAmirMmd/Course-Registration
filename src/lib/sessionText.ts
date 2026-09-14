import type { DayIndex, Session, SessionKind } from '../types'
import { DAY_NAMES, parseDayName } from './days'
import { normalizeFa, toFaDigits, toLatinDigits } from './digits'
import { faTime, orderTimePair } from './time'

/**
 * نمایش متنی و قابل‌ویرایشِ جلسه‌ها — هر جلسه یک خط:
 *   «شنبه ۱۰:۰۰-۱۱:۳۰ | کلاس ۲۰۲ (ت)»
 * همین قالب دوباره با parseSessionsText خوانده می‌شود.
 */
export function formatSessions(sessions: Session[]): string {
  return sessions
    .map((s) => {
      const kind = s.kind === 'practical' ? ' (ع)' : s.kind === 'theory' ? ' (ت)' : ''
      const loc = s.location ? ` | ${toFaDigits(s.location)}` : ''
      return `${DAY_NAMES[s.day]} ${faTime(s.start)}-${faTime(s.end)}${loc}${kind}`
    })
    .join('\n')
}

const TIME_PAIR = /([0-9۰-۹٠-٩]{1,2}:[0-9۰-۹٠-٩]{2})\s*-\s*([0-9۰-۹٠-٩]{1,2}:[0-9۰-۹٠-٩]{2})/

export interface SessionTextResult {
  sessions: Session[]
  errors: string[]
}

/** خواندن همان قالب بالا (سهل‌گیرانه) */
export function parseSessionsText(text: string): SessionTextResult {
  const sessions: Session[] = []
  const errors: string[] = []
  for (const rawLine of text.split(/\n+/)) {
    const line = normalizeFa(rawLine)
    if (!line) continue
    const [main, locPart] = line.split('|')
    const day = parseDayName(main)
    const tm = TIME_PAIR.exec(main)
    if (day === null) {
      errors.push(`روز در «${rawLine.trim()}» شناسایی نشد`)
      continue
    }
    if (!tm) {
      errors.push(`ساعت در «${rawLine.trim()}» شناسایی نشد`)
      continue
    }
    const { start, end } = orderTimePair(tm[1], tm[2])
    const kind: SessionKind | undefined = /\(\s*ع\s*\)/.test(line)
      ? 'practical'
      : /\(\s*ت\s*\)/.test(line)
        ? 'theory'
        : undefined
    const location = locPart
      ? toLatinDigits(locPart).replace(/\(\s*[تع]\s*\)/g, '').trim()
      : undefined
    const session: Session = { day: day as DayIndex, start, end }
    if (location) session.location = location
    if (kind) session.kind = kind
    sessions.push(session)
  }
  return { sessions, errors }
}
