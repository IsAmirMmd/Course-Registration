import { useRef, useState } from 'react'
import type { Course } from '../types'
import { coursesToRows, parseRawTable, rowsToCourses, type DraftRow } from '../lib/parseTable'
import { toFaDigits } from '../lib/digits'
import { Notice } from '../components/ui'

interface Props {
  courses: Course[]
  onSave: (courses: Course[]) => void
  onGoNext: () => void
}

const SAMPLE = `<table>
<tr><th>شماره و گروه درس</th><th>نام درس</th><th>واحد</th><th>ظرفیت</th><th>نام استاد</th><th>زمان و مکان ارائه/ امتحان</th></tr>
<tr><td>۱۲۲۱۰۰۸_۰۱</td><td>طراحی الگوریتمها</td><td>۳</td><td>۴۰</td><td>زمانی فاطمه</td>
<td>درس(ت): شنبه(۱۰:۰۰-۱۱:۳۰ مکان: کلاس ۲۰۲<br>درس(ت): دوشنبه (۱۰:۰۰-۱۱:۳۰ مکان: کلاس ۲۰۲<br>امتحان(۱۴۰۵.۱۰.۲۲) ساعت: ۱۳:۳۰-۱۵:۳۰</td></tr>
<tr><td>۱۲۲۱۰۱۹_۰۱</td><td>آزمایشگاه شبکه کامپیوتری</td><td>۱</td><td>۱۲</td><td>فیروزمندی همت</td>
<td>درس(ع): یک شنبه (۱۳:۳۰-۱۵:۳۰</td></tr>
<tr><td>۱۲۲۱۰۱۹_۰۲</td><td>آزمایشگاه شبکه کامپیوتری</td><td>۱</td><td>۱۲</td><td>فیروزمندی همت</td>
<td>درس(ع): یک شنبه (۱۷:۳۰-۱۹:۳۰</td></tr>
</table>`

/** صفحه‌ی «افزودن درس‌ها»: پیست HTML خام یا آپلود فایل، سپس پیش‌نمایشِ قابل‌ویرایش */
export function ImportPage({ courses, onSave, onGoNext }: Props) {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [notes, setNotes] = useState<string[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const runParse = (text: string) => {
    const report = parseRawTable(text)
    setRows(report.rows)
    setErrors(report.errors)
    setNotes(report.notes)
    setSaved(null)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setRaw(text)
    runParse(text)
  }

  const edit = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => (prev ? prev.map((r) => (r.key === key ? { ...r, ...patch } : r)) : prev))
    setSaved(null)
  }

  const removeRow = (key: string) => {
    setRows((prev) => (prev ? prev.filter((r) => r.key !== key) : prev))
    setSaved(null)
  }

  const save = (mode: 'replace' | 'merge') => {
    if (!rows) return
    const built = rowsToCourses(rows)
    onSave(mode === 'replace' ? built.courses : mergeCourses(courses, built.courses))
    const groups = built.courses.reduce((n, c) => n + c.groups.length, 0)
    setSaved(
      `${toFaDigits(built.courses.length)} درس و ${toFaDigits(groups)} گروه ذخیره شد` +
        (built.problems.length ? ` (${toFaDigits(built.problems.length)} هشدار)` : ''),
    )
    setErrors(built.problems)
  }

  const warnCount = rows?.filter((r) => r.warnings.length > 0).length ?? 0
  const courseCount = rows ? new Set(rows.map((r) => r.courseCode)).size : 0

  return (
    <div className="page">
      <div className="card">
        <h2 className="section-title">افزودن درس‌ها از جدول خام دانشگاه</h2>
        <p className="section-hint">
          جدول سیستم انتخاب‌واحد را باز کنید، کل جدول را کپی و اینجا پیست کنید (یا فایل{' '}
          <span className="num">HTML</span> صفحه را آپلود کنید). ردیف‌ها خودکار خوانده می‌شوند:
          چند جلسه در یک سلول، نام روزهای فارسی، ارقام فارسی و تاریخ امتحان. متن ساده هم
          پذیرفته می‌شود.
        </p>

        <textarea
          className="field"
          rows={7}
          dir="ltr"
          placeholder="<table> ... </table>"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />

        <div className="row row--wrap" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => runParse(raw)}
            disabled={!raw.trim()}
          >
            خواندن جدول
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            آپلود فایل HTML
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,.htm,.txt,text/html,text/plain"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              setRaw(SAMPLE)
              runParse(SAMPLE)
            }}
          >
            نمونه‌ی آزمایشی
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              const r = coursesToRows(courses)
              setRows(r)
              setErrors([])
              setNotes([`${toFaDigits(r.length)} ردیفِ ذخیره‌شده برای ویرایش باز شد.`])
              setSaved(null)
            }}
            disabled={courses.length === 0}
          >
            ویرایش درس‌های ذخیره‌شده
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <Notice kind="danger">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </Notice>
      )}
      {notes.map((n, i) => (
        <Notice key={i} kind="warn">
          {n}
        </Notice>
      ))}
      {saved && <Notice kind="info">{saved}</Notice>}

      {rows && (
        <div className="card">
          <div className="row row--wrap" style={{ marginBottom: 12 }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              پیش‌نمایش قابل‌ویرایش
            </h2>
            <span className="chip chip--sunk">
              {toFaDigits(rows.length)} ردیف · {toFaDigits(courseCount)} درس
            </span>
            {warnCount > 0 && (
              <span className="chip chip--warn">{toFaDigits(warnCount)} ردیف نیازمند بازبینی</span>
            )}
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => save('replace')}
              disabled={rows.length === 0}
            >
              ذخیره (جایگزینی کامل)
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => save('merge')}
              disabled={rows.length === 0}
            >
              افزودن به فهرست فعلی
            </button>
            <button type="button" className="btn btn--sm" onClick={onGoNext} disabled={!saved}>
              رفتن به انتخاب درس‌ها
            </button>
          </div>

          <p className="section-hint">
            هر خطِ ستون «جلسه‌ها» یک جلسه است، به قالب «روز ساعت‌شروع-ساعت‌پایان | مکان».
            پیش از ذخیره، ردیف‌های زردرنگ را بازبینی کنید.
          </p>

          <div className="preview-wrap">
            <table className="preview">
              <thead>
                <tr>
                  <th>کد درس</th>
                  <th>گروه</th>
                  <th>نام درس</th>
                  <th>واحد</th>
                  <th>ظرفیت</th>
                  <th>استاد</th>
                  <th>جلسه‌ها (هر خط یک جلسه)</th>
                  <th>تاریخ امتحان</th>
                  <th>ساعت امتحان</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className={row.warnings.length ? 'has-warn' : undefined}>
                    <td className="w-code">
                      <input
                        className="cell-input cell-input--code"
                        value={row.courseCode}
                        onChange={(e) => edit(row.key, { courseCode: e.target.value })}
                        aria-label="کد درس"
                      />
                    </td>
                    <td className="w-grp">
                      <input
                        className="cell-input cell-input--code"
                        value={row.groupNo}
                        onChange={(e) => edit(row.key, { groupNo: e.target.value })}
                        aria-label="شماره گروه"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={row.name}
                        onChange={(e) => edit(row.key, { name: e.target.value })}
                        aria-label="نام درس"
                      />
                    </td>
                    <td className="w-num">
                      <input
                        className="cell-input cell-input--code"
                        value={row.credits}
                        onChange={(e) => edit(row.key, { credits: e.target.value })}
                        aria-label="واحد"
                      />
                    </td>
                    <td className="w-num">
                      <input
                        className="cell-input cell-input--code"
                        value={row.capacity}
                        onChange={(e) => edit(row.key, { capacity: e.target.value })}
                        aria-label="ظرفیت"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        value={row.instructor}
                        onChange={(e) => edit(row.key, { instructor: e.target.value })}
                        aria-label="استاد"
                      />
                    </td>
                    <td className="w-time">
                      <textarea
                        className="cell-input"
                        value={row.sessionsText}
                        onChange={(e) => edit(row.key, { sessionsText: e.target.value })}
                        rows={Math.max(2, row.sessionsText.split('\n').length)}
                        aria-label="جلسه‌ها"
                      />
                      {row.warnings.map((w, i) => (
                        <div key={i} style={{ color: 'var(--warn)', fontSize: 11, padding: '0 8px' }}>
                          {w}
                        </div>
                      ))}
                    </td>
                    <td className="w-exam">
                      <input
                        className="cell-input cell-input--code"
                        value={row.examDate}
                        onChange={(e) => edit(row.key, { examDate: e.target.value })}
                        aria-label="تاریخ امتحان"
                      />
                    </td>
                    <td className="w-exam">
                      <input
                        className="cell-input cell-input--code"
                        value={row.examTime}
                        onChange={(e) => edit(row.key, { examTime: e.target.value })}
                        aria-label="ساعت امتحان"
                      />
                    </td>
                    <td style={{ width: 44 }}>
                      <button
                        type="button"
                        className="btn btn--sm btn--icon"
                        onClick={() => removeRow(row.key)}
                        title="حذف ردیف"
                        aria-label="حذف ردیف"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** ادغام: درس‌های هم‌کد یکی می‌شوند و گروه‌های تازه اضافه می‌شوند */
function mergeCourses(existing: Course[], incoming: Course[]): Course[] {
  const byCode = new Map(existing.map((c) => [c.code, { ...c, groups: [...c.groups] }]))
  for (const c of incoming) {
    const found = byCode.get(c.code)
    if (!found) {
      byCode.set(c.code, { ...c, groups: [...c.groups] })
      continue
    }
    for (const g of c.groups) {
      const at = found.groups.findIndex((x) => x.id === g.id)
      if (at >= 0) found.groups[at] = g
      else found.groups.push(g)
    }
    if (c.exam && !found.exam) found.exam = c.exam
  }
  return Array.from(byCode.values())
}
