import { useState } from 'react'
import type { Course } from '../types'
import { toFaDigits } from '../lib/digits'
import { planStats, suggestName, type PlanSnapshot, type SavedPlan } from '../lib/plans'
import { Chevron } from './ui'
import './PlanBar.css'

interface Props {
  plans: SavedPlan[]
  activeId: string | null
  /** وضعیتِ همین لحظه — برای «ذخیره» و برای نشان‌دادنِ تغییرِ ذخیره‌نشده */
  current: PlanSnapshot
  dirty: boolean
  catalogue: Course[]
  onSave: () => void
  onSaveAs: (name: string) => void
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onNewDraft: () => void
}

function faDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

/**
 * نوارِ «برنامه‌های ذخیره‌شده»: چند مجموعه‌ی مستقل از انتخاب‌ها کنار هم، تا بشود
 * سبک‌های مختلفِ برنامه (یا برنامه‌ی یک نفر دیگر) را بدون از‌دست‌دادنِ کارِ فعلی چید.
 */
export function PlanBar({
  plans,
  activeId,
  current,
  dirty,
  catalogue,
  onSave,
  onSaveAs,
  onOpen,
  onRename,
  onDelete,
  onNewDraft,
}: Props) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const active = plans.find((p) => p.id === activeId) ?? null
  const stats = planStats(current, catalogue)
  const empty = current.selected.length === 0

  const startSaveAs = () => {
    setRenaming(null)
    setDraftName(active ? `${active.name} (کپی)` : suggestName(plans))
    setNaming('new')
    setOpen(true)
  }

  const commitName = () => {
    if (naming) onSaveAs(draftName)
    else if (renaming) onRename(renaming, draftName)
    setNaming(null)
    setRenaming(null)
  }

  const cancelName = () => {
    setNaming(null)
    setRenaming(null)
  }

  const askOpen = (plan: SavedPlan) => {
    if (plan.id === activeId) return
    if (dirty) {
      const what = active
        ? `تغییرهای ذخیره‌نشده‌ی «${active.name}»`
        : 'انتخاب‌های ذخیره‌نشده‌ی فعلی'
      if (!confirm(`${what} از بین می‌رود. «${plan.name}» باز شود؟`)) return
    }
    onOpen(plan.id)
    setOpen(false)
  }

  const askDelete = (plan: SavedPlan) => {
    if (!confirm(`برنامه‌ی «${plan.name}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return
    onDelete(plan.id)
  }

  const askNewDraft = () => {
    if (dirty && !confirm('انتخاب‌های ذخیره‌نشده‌ی فعلی پاک می‌شود. برنامه‌ی تازه شروع شود؟')) return
    onNewDraft()
    setOpen(false)
  }

  return (
    <div className="planbar">
      <div className="row row--wrap planbar__head">
        <button
          type="button"
          className={`btn btn--sm planbar__toggle${open ? ' is-active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          برنامه‌های ذخیره‌شده
          <span className="tabs__badge num">{toFaDigits(plans.length)}</span>
          <Chevron open={open} />
        </button>

        <span className="planbar__now">
          <strong className="planbar__name">{active ? active.name : 'پیش‌نویسِ ذخیره‌نشده'}</strong>
          <span className="muted planbar__stats num">
            {toFaDigits(stats.courses)} درس · {toFaDigits(stats.credits)} واحد
          </span>
          {dirty && (
            <span className="chip chip--warn" title="این تغییرها هنوز در هیچ برنامه‌ای ذخیره نشده‌اند">
              ذخیره‌نشده
            </span>
          )}
        </span>

        <span className="spacer" />

        <button
          type="button"
          className="btn btn--sm"
          onClick={onSave}
          disabled={!active || !dirty}
          title={
            active
              ? 'تغییرها روی همین برنامه ذخیره شود'
              : 'هنوز برنامه‌ای باز نیست — از «ذخیره به‌عنوان جدید» شروع کنید'
          }
        >
          ذخیره
        </button>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={startSaveAs}
          disabled={empty}
          title={empty ? 'اول چند درس انتخاب کنید' : 'انتخاب‌های فعلی را به‌عنوان برنامه‌ای تازه ذخیره کن'}
        >
          ذخیره به‌عنوان جدید
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={askNewDraft}
          disabled={empty && !active}
          title="شروع از صفر، بدون دست‌زدن به برنامه‌های ذخیره‌شده"
        >
          برنامه‌ی تازه
        </button>
      </div>

      {open && (
        <div className="planbar__body">
          {naming === 'new' && (
            <form
              className="planbar__form"
              onSubmit={(e) => {
                e.preventDefault()
                commitName()
              }}
            >
              <input
                className="field"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="مثلاً «برنامه‌ی خودم» یا «برنامه‌ی علی»"
                aria-label="نام برنامه‌ی تازه"
                // کادر را همین حالا کاربر باز کرده، پس تمرکز روی آن پرت‌کننده نیست
                autoFocus
              />
              <button type="submit" className="btn btn--primary btn--sm">
                ذخیره
              </button>
              <button type="button" className="btn btn--sm" onClick={cancelName}>
                انصراف
              </button>
            </form>
          )}

          {plans.length === 0 ? (
            <p className="muted planbar__empty">
              هنوز برنامه‌ای ذخیره نکرده‌اید. درس‌هایتان را انتخاب کنید و «ذخیره به‌عنوان جدید» را
              بزنید؛ بعد می‌توانید انتخاب‌های کاملاً متفاوتی بچینید بدون اینکه این یکی از بین برود.
            </p>
          ) : (
            <ul className="planbar__list">
              {plans.map((plan) => {
                const s = planStats(plan, catalogue)
                const isActive = plan.id === activeId
                return (
                  <li key={plan.id} className={`planbar__item${isActive ? ' is-active' : ''}`}>
                    {renaming === plan.id ? (
                      <form
                        className="planbar__form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          commitName()
                        }}
                      >
                        <input
                          className="field"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          aria-label={`نام تازه برای ${plan.name}`}
                          // کاربر همین حالا «تغییر نام» را زده
                          autoFocus
                        />
                        <button type="submit" className="btn btn--primary btn--sm">
                          ثبت
                        </button>
                        <button type="button" className="btn btn--sm" onClick={cancelName}>
                          انصراف
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="planbar__open"
                          onClick={() => askOpen(plan)}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          <span className="planbar__item-name">{plan.name}</span>
                          <span className="muted planbar__item-meta num">
                            {toFaDigits(s.courses)} درس · {toFaDigits(s.credits)} واحد
                            {plan.audit ? ' · با کارنامه' : ''}
                            {plan.mode === 'manual' ? ' · دستی' : ''}
                            {' · '}
                            {faDate(plan.updatedAt)}
                          </span>
                        </button>
                        {isActive && <span className="chip chip--good">باز</span>}
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => {
                            setNaming(null)
                            setDraftName(plan.name)
                            setRenaming(plan.id)
                          }}
                        >
                          تغییر نام
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => askDelete(plan)}
                        >
                          حذف
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
