import { useMemo } from 'react'
import type { DayIndex, PlacedSession } from '../types'
import { DAY_NAMES, DAY_SHORT } from '../lib/days'
import { courseTint, layoutWeek } from '../lib/layout'
import { clashingSessionKeys, sessionKey } from '../lib/conflicts'
import { faTime, fromMinutes } from '../lib/time'
import { toFaDigits } from '../lib/digits'
import './WeeklyGrid.css'

interface Props {
  placed: PlacedSession[]
  /** حالت بند‌انگشتی برای پیش‌نمایش ترکیب‌ها */
  mini?: boolean
  /** ستون‌های ثابت (حالت دستی) — پیش‌فرض: فقط روزهای دارای کلاس */
  fixedDays?: DayIndex[]
  selectedCode?: string | null
  onBlockClick?: (placed: PlacedSession) => void
  emptyLabel?: string
}

export function WeeklyGrid({
  placed,
  mini = false,
  fixedDays,
  selectedCode = null,
  onBlockClick,
  emptyLabel = 'هنوز هیچ کلاسی در برنامه نیست.',
}: Props) {
  const pxPerMin = mini ? 0.2 : 1.05
  const layout = useMemo(
    () => layoutWeek(placed, { pxPerMin, allDays: fixedDays }),
    [placed, pxPerMin, fixedDays],
  )
  const clashing = useMemo(() => clashingSessionKeys(placed), [placed])

  if (layout.days.length === 0) {
    return <div className="wg__empty">{emptyLabel}</div>
  }

  const cols = `repeat(${layout.days.length}, minmax(0, 1fr))`

  return (
    <div className={`wg${mini ? ' wg--mini' : ''}`}>
      {!mini && <div aria-hidden="true" />}
      <div className="wg__days" style={{ gridTemplateColumns: cols }}>
        {layout.days.map((day) => (
          <div key={`h${day}`} className="wg__dayname">
            {mini ? DAY_SHORT[day] : DAY_NAMES[day]}
          </div>
        ))}
      </div>

      {!mini && (
        <div className="wg__hours" style={{ height: layout.heightPx }}>
          {layout.hourMarks.map((m) => (
            <div
              key={m}
              className="wg__hour"
              style={{ top: (m - layout.startMin) * pxPerMin }}
            >
              {faTime(fromMinutes(m))}
            </div>
          ))}
        </div>
      )}

      <div className="wg__days" style={{ gridTemplateColumns: cols }}>
        {layout.days.map((day) => (
          <div key={day} className="wg__day" style={{ height: layout.heightPx }}>
            {layout.hourMarks.slice(1, -1).map((m) => (
              <div
                key={m}
                className="wg__line"
                style={{ top: (m - layout.startMin) * pxPerMin }}
              />
            ))}
            {(layout.blocksByDay.get(day) ?? []).map((block) => {
              const { placed: p } = block
              const key = sessionKey(p)
              const isClash = clashing.has(key)
              const isSelected = selectedCode === p.course.code
              const label = `${p.course.name} — گروه ${toFaDigits(p.group.groupNo ?? '')} — ${faTime(
                p.session.start,
              )} تا ${faTime(p.session.end)}${isClash ? ' — دارای تداخل' : ''}`
              return (
                <button
                  key={key}
                  type="button"
                  className={`wg__block${isClash ? ' is-clash' : ''}${isSelected ? ' is-selected' : ''}`}
                  style={{
                    top: block.topPx,
                    height: block.heightPx,
                    insetInlineStart: `${block.leftPct}%`,
                    width: `calc(${block.widthPct}% - 3px)`,
                    ['--block-tint' as string]: courseTint(p.course.code),
                  }}
                  onClick={() => onBlockClick?.(p)}
                  title={label}
                  aria-label={label}
                  tabIndex={mini ? -1 : 0}
                >
                  {!mini && (
                    <>
                      <span className="wg__block-name">{p.course.name}</span>
                      <span className="wg__block-meta">
                        {faTime(p.session.start)}–{faTime(p.session.end)}
                        {p.session.kind === 'practical' ? ' · عملی' : ''}
                      </span>
                      {block.heightPx > 74 && p.group.instructor && (
                        <span className="wg__block-meta">{p.group.instructor}</span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
