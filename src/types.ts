/** 0 = شنبه … 6 = جمعه */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** نوع جلسه: نظری (ت) یا عملی (ع) */
export type SessionKind = 'theory' | 'practical'

export interface Session {
  day: DayIndex
  /** "HH:MM" با ارقام لاتین */
  start: string
  /** "HH:MM" با ارقام لاتین */
  end: string
  location?: string
  kind?: SessionKind
}

export interface Group {
  id: string
  instructor: string
  capacity: number
  /** آرایه‌ی خالی یعنی بدون زمان کلاسی ثابت (مثل پروژه‌ی پایانی) */
  sessions: Session[]
  /** شماره‌ی گروه، مثل «۰۱» */
  groupNo?: string
}

export interface Exam {
  /** تاریخ شمسی به شکل YYYY/MM/DD */
  date: string
  /** "HH:MM-HH:MM" */
  time: string
}

export interface Course {
  code: string
  name: string
  credits: number
  exam?: Exam
  groups: Group[]
}

/** یک انتخاب: کد درس → شناسه‌ی گروه */
export type Picks = Record<string, string>

export interface PlacedSession {
  session: Session
  course: Course
  group: Group
}
