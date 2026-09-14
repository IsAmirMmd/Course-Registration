# -*- coding: utf-8 -*-
import json, re
from collections import OrderedDict

FA = '٠١٢٣٤٥٦٧٨٩'
def lat(s):
    return ''.join(str(FA.index(c)) if c in FA else c for c in s)

DAYS = [
    ('چهارشنبه', 4), ('چهار شنبه', 4), ('پنجشنبه', 5), ('پنج شنبه', 5),
    ('یکشنبه', 1), ('یک شنبه', 1), ('دوشنبه', 2), ('دو شنبه', 2),
    ('سهشنبه', 3), ('سه شنبه', 3), ('جمعه', 6), ('شنبه', 0),
]
TIME = re.compile(r'([٠-٩0-9]{1,2}:[٠-٩0-9]{2})\s*-\s*([٠-٩0-9]{1,2}:[٠-٩0-9]{2})')
EXAM = re.compile(r'امتحان\s*\(\s*([٠-٩0-9/\.]+)\s*\)\s*ساعت\s*:\s*' + TIME.pattern)

def hhmm(t):
    h, m = lat(t).split(':')
    return f'{int(h):02d}:{int(m):02d}'

def minutes(t):
    h, m = t.split(':')
    return int(h) * 60 + int(m)

def pair(a, b):
    """The two printed times are an unordered visual pair; earlier one is the start."""
    a, b = hhmm(a), hhmm(b)
    return (a, b) if minutes(a) <= minutes(b) else (b, a)

def find_day(chunk):
    for name, idx in DAYS:
        if name in chunk:
            return idx, name
    return None, None

def parse_time_cell(lines):
    blob = ' '.join(l for l in lines if l.strip())
    blob = re.sub(r'\s+', ' ', blob)
    exam = None
    m = EXAM.search(blob)
    if m:
        d = lat(m.group(1)).replace('.', '/')
        s, e = pair(m.group(2), m.group(3))
        exam = {'date': d, 'time': f'{s}-{e}'}
        blob = blob[:m.start()] + ' ' + blob[m.end():]
    sessions = []
    parts = re.split(r'درس\s*\(', blob)
    for p in parts[1:]:
        kind = 'practical' if p.lstrip().startswith('ع') else 'theory'
        p = re.sub(r'^\s*[تع]\s*\)\s*:?', '', p)
        day, dayname = find_day(p)
        tm = TIME.search(p)
        if day is None or not tm:
            continue
        s, e = pair(tm.group(1), tm.group(2))
        loc = ''
        lm = re.search(r'مکان\s*:\s*(.+)$', p)
        if lm:
            loc = re.sub(r'\s+', ' ', lat(lm.group(1))).strip()
        sess = {'day': day, 'start': s, 'end': e, 'kind': kind}
        if loc:
            sess['location'] = loc
        sessions.append(sess)
    return sessions, exam

rows = json.load(open('raw_rows.json'))
courses = OrderedDict()
warn = []
for r in rows:
    sessions, exam = parse_time_cell(r['time'])
    has_class = any('درس' in t for t in r['time'])
    if has_class and not sessions:
        warn.append(('no-session-parsed', r['courseCode'], r['groupNo'], r['time']))
    code = r['courseCode']
    c = courses.get(code)
    if c is None:
        c = courses[code] = {
            'code': code,
            'name': r['name'].strip(),
            'credits': int(r['credits'] or 0),
            'groups': [],
        }
        if exam:
            c['exam'] = exam
    if exam and 'exam' not in c:
        c['exam'] = exam
    c['groups'].append({
        'id': f"{code}_{r['groupNo']}",
        'groupNo': r['groupNo'],
        'instructor': re.sub(r'\s+', ' ', r['instructor']).strip(),
        'capacity': int(r['capacity'] or 0),
        'sessions': sessions,
    })

out = list(courses.values())
json.dump(out, open('seed.json', 'w'), ensure_ascii=False, indent=1)
print('courses:', len(out), 'groups:', sum(len(c['groups']) for c in out))
print('warnings:', len(warn))
for w in warn[:10]: print(' ', w)
nosess = sum(1 for c in out for g in c['groups'] if not g['sessions'])
print('groups with no sessions:', nosess)
# sanity: any session with end <= start, or day out of range
bad = [(c['code'], g['id'], s) for c in out for g in c['groups'] for s in g['sessions']
       if minutes(s['end']) <= minutes(s['start']) or not (0 <= s['day'] <= 6)]
print('bad sessions:', len(bad))
for c in out[:3]: print(json.dumps(c, ensure_ascii=False)[:600])
