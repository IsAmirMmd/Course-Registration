# -*- coding: utf-8 -*-
"""استخراج ردیف‌های درس/گروه از PDF «گزارش ۱۱۰» دانشگاه صنعتی نوشیروانی بابل.

این PDF متن را به ترتیب «دیداری» (چپ‌به‌راست) می‌نویسد، پس متن فارسی باید معکوس
و از شکل‌های نمایشی عربی به حروف پایه برگردانده شود؛ در عوض عددها و ساعت‌ها در همان
ترتیب x درست‌اند. ستون‌ها از مختصات x نویسه‌ها تشخیص داده می‌شوند.

    python3 tools/extract.py a.pdf b.pdf   # → tools/raw_rows.json
    python3 tools/build_seed.py            # → tools/seed.json
    python3 tools/gen_seed_ts.py           # → src/data/seed.ts
"""
import pdfplumber, glob, json, re, sys, unicodedata
from collections import defaultdict

MIRROR = {'(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '«': '»', '»': '«'}
LTR_CHARS = set("0123456789٠١٢٣٤٥٦٧٨٩:-/_.،" ) | set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
FA_DIGITS = '٠١٢٣٤٥٦٧٨٩'

def is_ltr(ch):
    return ch in LTR_CHARS

def visual_to_logical(vis):
    """Turn a visual-order (left-to-right as painted) RTL string into logical order."""
    rev = ''.join(MIRROR.get(c, c) for c in reversed(vis))
    # re-reverse maximal runs of LTR characters (numbers, times, dates, latin)
    out, i, n = [], 0, len(rev)
    while i < n:
        if is_ltr(rev[i]):
            j = i
            while j < n and is_ltr(rev[j]):
                j += 1
            out.append(rev[i:j][::-1])
            i = j
        else:
            out.append(rev[i])
            i += 1
    t = ''.join(out)
    t = ''.join(unicodedata.normalize('NFKC', c) for c in t)
    t = t.replace('ي', 'ی').replace('ى', 'ی').replace('ك', 'ک').replace('ـ', '')
    return re.sub(r'\s+', ' ', t).strip()

def digits_to_latin(s):
    return ''.join(str(FA_DIGITS.index(c)) if c in FA_DIGITS else c for c in s)

COLS = [
    ('code',        530, 1e9),
    ('name',        395, 530),
    ('credits',     377, 395),
    ('practical',   360, 377),
    ('capacity',    338, 360),
    ('registered',  308, 338),
    ('waitlist',    275, 308),
    ('gender',      238, 275),
    ('instructor',  166, 238),
    ('time',       -1e9, 166),
]

def col_of(x):
    for name, lo, hi in COLS:
        if lo <= x < hi:
            return name
    return None

def page_lines(page):
    """Return list of (top, {col: visual_text}) for content rows."""
    buckets = defaultdict(lambda: defaultdict(list))
    for ch in page.chars:
        if ch['top'] < 120:      # page header block
            continue
        key = round(ch['top'] / 3.0)
        c = col_of(ch['x0'])
        if c:
            buckets[key][c].append(ch)
    lines = []
    for key in sorted(buckets):
        cells = {}
        for c, chars in buckets[key].items():
            chars.sort(key=lambda ch: ch['x0'])
            txt = ''.join(ch['text'] for ch in chars)
            if txt.strip():
                cells[c] = txt
        if cells:
            lines.append((key * 3.0, cells))
    return lines

CODE_RE = re.compile(r'^([٠-٩]{5,9})_([٠-٩]{1,3})$')

def main():
    files = sorted(sys.argv[1:]) or sorted(glob.glob('pdf/*.pdf'))
    if not files:
        raise SystemExit(
            'usage: python3 tools/extract.py <report-110.pdf> [more.pdf ...]\n'
            '(or put the PDFs in ./pdf/)'
        )
    records = []
    for f in files:
        with pdfplumber.open(f) as pdf:
            for page in pdf.pages:
                for top, cells in page_lines(page):
                    code_vis = cells.get('code', '')
                    code_txt = code_vis.replace(' ', '')
                    m = CODE_RE.match(code_txt)
                    if m:
                        records.append({
                            'source': f.split('/')[-1][:8],
                            'courseCode': digits_to_latin(m.group(1)),
                            'groupNo': digits_to_latin(m.group(2)),
                            'name': [cells.get('name', '')],
                            'credits': cells.get('credits', ''),
                            'practical': cells.get('practical', ''),
                            'capacity': cells.get('capacity', ''),
                            'gender': [cells.get('gender', '')],
                            'instructor': [cells.get('instructor', '')],
                            'time': [cells.get('time', '')],
                        })
                    elif records:
                        r = records[-1]
                        for k in ('name', 'instructor', 'time', 'gender'):
                            if cells.get(k):
                                r[k].append(cells[k])
                        for k in ('credits', 'practical', 'capacity'):
                            if cells.get(k) and not r[k]:
                                r[k] = cells[k]
    # normalize
    for r in records:
        r['name'] = ' '.join(visual_to_logical(p) for p in r['name'] if p.strip())
        r['instructor'] = ' '.join(visual_to_logical(p) for p in r['instructor'])
        r['gender'] = visual_to_logical(r['gender'][0]) if r['gender'] else ''
        r['time'] = [visual_to_logical(p) for p in r['time']]
        for k in ('credits', 'practical', 'capacity'):
            r[k] = digits_to_latin(r[k])
    json.dump(records, open('raw_rows.json', 'w'), ensure_ascii=False, indent=1)
    print('rows:', len(records))
    for r in records[:6]:
        print(json.dumps(r, ensure_ascii=False))

if __name__ == '__main__':
    main()
