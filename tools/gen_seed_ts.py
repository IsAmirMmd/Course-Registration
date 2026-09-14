# -*- coding: utf-8 -*-
"""seed.json → src/data/seed.ts"""
import io, json

courses = json.load(io.open('seed.json', encoding='utf-8'))
head = """// این فایل به‌صورت خودکار از PDF «دروس ارائه شده در نیمسال اول ۱۴۰۵-۱۴۰۶»
// دانشگاه صنعتی نوشیروانی بابل (گزارش ۱۱۰) ساخته شده است.
// بازتولید: python3 tools/extract.py && python3 tools/build_seed.py && python3 tools/gen_seed_ts.py
// دست‌کاری دستی نکنید؛ تغییرها را در tools/ اعمال کنید.
import type { Course } from '../types'

export const SEED_COURSES: Course[] = """
body = json.dumps(courses, ensure_ascii=False, indent=2)
io.open('../src/data/seed.ts', 'w', encoding='utf-8').write(head + body + '\n')
print('courses', len(courses), 'groups', sum(len(c['groups']) for c in courses))
