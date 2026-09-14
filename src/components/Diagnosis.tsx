import type { Course } from '../types'
import { DAY_NAMES } from '../lib/days'
import { toFaDigits } from '../lib/digits'
import { faTime } from '../lib/time'
import type { Diagnosis as DiagnosisData } from '../lib/solver'

/**
 * وقتی هیچ ترکیب بی‌تداخلی وجود ندارد، دقیقاً مقصر را نشان می‌دهد:
 * کدام دو درس، کدام گروه‌ها و کدام جلسه‌ها با هم تصادم دارند.
 */
export function Diagnosis({ data, onDrop }: { data: DiagnosisData; onDrop?: (code: string) => void }) {
  return (
    <div className="card">
      <h2 className="section-title">هیچ ترکیب بی‌تداخلی وجود ندارد — علت دقیقاً این است</h2>
      <p className="section-hint">
        مشکل از «نبودِ جواب» نیست؛ درس‌های زیر با هم جمع نمی‌شوند. برای هر مورد، جلسه‌ی
        متصادم آورده شده است.
      </p>

      {data.emptyCourses.length > 0 && (
        <div className="notice notice--danger" style={{ marginBottom: 12 }}>
          این درس‌ها هیچ گروهی ندارند:{' '}
          {data.emptyCourses.map((c) => c.name).join('، ')}
        </div>
      )}

      {data.blockingPairs.length === 0 && data.emptyCourses.length === 0 && (
        <div className="notice notice--warn" style={{ marginBottom: 12 }}>
          هیچ جفت‌درسِ قطعاً متصادمی پیدا نشد؛ تصادم از ترکیبِ سه درس یا بیشتر می‌آید.
          پیشنهادهای حذف را ببینید.
        </div>
      )}

      <div className="stack">
        {data.blockingPairs.map((pair) => (
          <div key={`${pair.courseA.code}-${pair.courseB.code}`} className="sunk" style={{ padding: 14 }}>
            <div className="row row--wrap" style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 13.5 }}>
                {pair.courseA.name} × {pair.courseB.name}
              </strong>
              <span className="chip chip--danger">
                {pair.reason === 'exam' ? 'تداخل تاریخ امتحان' : 'همه‌ی گروه‌ها متصادم‌اند'}
              </span>
              {onDrop && (
                <>
                  <span className="spacer" />
                  <button type="button" className="btn btn--sm" onClick={() => onDrop(pair.courseA.code)}>
                    حذف «{pair.courseA.name}»
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => onDrop(pair.courseB.code)}>
                    حذف «{pair.courseB.name}»
                  </button>
                </>
              )}
            </div>
            <ul className="detail__sessions">
              {pair.samples.map((s, i) => (
                <li key={i}>
                  <span className="chip chip--sunk num">
                    گروه {toFaDigits(s.groupA.groupNo ?? '')}
                  </span>
                  <span className="num">
                    {DAY_NAMES[s.sessionA.day]} {faTime(s.sessionA.start)}–{faTime(s.sessionA.end)}
                  </span>
                  <span className="muted">با</span>
                  <span className="chip chip--sunk num">
                    گروه {toFaDigits(s.groupB.groupNo ?? '')}
                  </span>
                  <span className="num">
                    {DAY_NAMES[s.sessionB.day]} {faTime(s.sessionB.start)}–{faTime(s.sessionB.end)}
                  </span>
                </li>
              ))}
              {pair.samples.length === 0 && pair.reason === 'exam' && (
                <li className="muted">
                  امتحان هر دو درس در {toFaDigits(pair.courseA.exam?.date ?? '')} است.
                </li>
              )}
            </ul>
          </div>
        ))}

        {data.dropSuggestions.length > 0 && (
          <div className="sunk" style={{ padding: 14 }}>
            <strong style={{ fontSize: 13.5 }}>
              با حذف هر یک از این مجموعه‌ها برنامه ساخته می‌شود
            </strong>
            <div className="row row--wrap" style={{ marginTop: 10 }}>
              {data.dropSuggestions.map((set, i) => (
                <span key={i} className="chip chip--sunk">
                  {set.map((c: Course) => c.name).join(' + ')}
                </span>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              بزرگ‌ترین مجموعه‌ی شدنی: {toFaDigits(data.maxFeasibleSize)} درس
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
