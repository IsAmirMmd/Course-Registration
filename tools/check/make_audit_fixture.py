# -*- coding: utf-8 -*-
"""ساخت نمونه‌ی «کارنامه‌ی تطبیق» گلستان برای تست پارسر.

ساختار HTML مو‌به‌مو از یک کارنامه‌ی واقعی گرفته شده، اما داده‌های هویتی
(نام، شماره دانشجو، شماره ملی، شناسنامه، تاریخ تولد، عکس) با مقدار ساختگی
جایگزین شده‌اند. داده‌ی تحصیلی (گروه‌های نیاز، درس‌ها، نمره‌ها) واقعی است،
چون هدفِ تست همان است.
"""
import io

OUT = 'tools/check/fixtures/audit.html'

ROW = ('<tr>\n<td>40100000000</td>\n<td>نام نمونه</td>\n<td>{payload}</td>\n'
       '<td>شماره دانشجو : 40100000000</td>\n<td>نام و نام خانوادگي : نام نمونه</td>\n</tr>')

HEADER_SUB = (
    '<table wi_dth="100%" border="0" cellspacing="0" cellpadding="0" style="TABLE-LAYOUT:FIXED;'
    'BORDER-COLLAPSE:COLLAPSE;FONT-FAMILY:Golestan Nazanin, Tahoma;FONT-SIZE:13px;" cla_ss="TBL">'
    '<tbody><tr><td cla_ss="MC" align="CENTER" width="50PX">معادل</td>'
    '<td cla_ss="MC" align="CENTER" width="180PX">نام درس معادل</td>'
    '<td cla_ss="MC" align="CENTER" width="20PX">واحد </td>'
    '<td cla_ss="MC" width="40PX" align="CENTER">ترم </td>'
    '<td cla_ss="MC" align="CENTER" width="50PX">نمره </td>'
    '<td cla_ss="MC" width="70PX">نوع درس </td></tr></tbody></table>'
)


def group_header(name, done_c, min_c, max_c, done_u, min_u, max_u, red):
    """سرصفحه‌ی گروهِ نیاز"""
    style = ' style="COLOR:RED"' if red else ''
    courses = (f'{done_c} درس از {min_c} درس برنامه ' if min_c == max_c
               else f'{done_c} درس از {min_c} تا {max_c} درس برنامه ')
    units = (f'<nobr dir="ltr">{done_u}</nobr> واحد از <nobr dir="ltr">{min_u}</nobr> واحد برنامه '
             if min_u == max_u else
             f'<nobr dir="ltr">{done_u}</nobr> واحد از <nobr dir="ltr">{min_u}</nobr> تا '
             f'<nobr dir="ltr">{max_u}</nobr> واحد برنامه ')
    return (
        '<table width="100%" cellspacing="0" cellpadding="0" style="TABLE-LAYOUT:FIXED;'
        'BORDER-COLLAPSE:COLLAPSE"><tbody><tr><td width="100%" valign="TOP" '
        'style="BORDER-COLLAPSE:COLLAPSE;BORDER:BLACK 1PX SOLID">'
        '<table bgcolor="#D3D3D3" width="100%" style="TABLE-LAYOUT:FIXED;BORDER-COLLAPSE:COLLAPSE;'
        'FONT-FAMILY:Golestan Nazanin, Tahoma;FONT-SIZE:14px"><tbody><tr>'
        f'<td width="35%"><b>{name}</b></td><td{style}>{courses}</td><td{style}>{units}</td>'
        '</tr></tbody></table>'
        '<table width="100%" style="TABLE-LAYOUT:FIXED;BORDER-COLLAPSE:COLLAPSE;FONT-FAMILY:'
        'Golestan Nazanin, Tahoma;FONT-SIZE:12px"><tbody><tr>'
        '<td valign="TOP" cla_ss="MC" width="50PX" align="CENTER">شماره</td>'
        '<td valign="TOP" cla_ss="MC" align="CENTER" width="200PX">نام درس</td>'
        '<td valign="TOP" cla_ss="MC" align="CENTER" width="20PX">واحد</td>'
        '<td valign="TOP" cla_ss="MC" align="CENTER" width="30PX">حالت</td>'
        f'<td valign="TOP">{HEADER_SUB}</td></tr></tbody></table></td></tr></tbody></table>'
    )


def course(code, name, credits, term=None, grade=None, kind=None):
    """ردیف درس؛ ترم/نمره یعنی «مصوب» (گذرانده)"""
    passed = grade is not None
    if passed:
        sub = (
            '<table wi_dth="100%" border="0" cellspacing="0" cellpadding="0" style="TABLE-LAYOUT:'
            'FIXED;BORDER-COLLAPSE:COLLAPSE" class="TBL"><tbody><tr>'
            '<td style="VERTICAL-ALIGN:TOP" class="LC" width="50PX">&nbsp;</td>'
            '<td style="VERTICAL-ALIGN:TOP; WHITE-SPACE:PRE-WRAP;" class="LC" width="180PX">&nbsp;</td>'
            f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="30PX"><nobr dir="ltr">{credits}</nobr></td>'
            f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="40PX">{term}</td>'
            f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="40PX"><nobr dir="ltr">{grade}</nobr></td>'
            f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="70PX"><nobr>{kind}</nobr></td>'
            '</tr></tbody></table>'
        )
    else:
        sub = ('<table wi_dth="100%" border="0" cellspacing="0" cellpadding="0" style="TABLE-LAYOUT:'
               'FIXED;BORDER-COLLAPSE:COLLAPSE" class="TBL"><tbody><tr><td>&nbsp;</td></tr></tbody></table>')
    state = 'مصوب' if passed else ''
    return (
        '<table width="100%" cellspacing="0" cellpadding="0" style="TABLE-LAYOUT:FIXED;'
        'BORDER-COLLAPSE:COLLAPSE" class="TBL"><tbody><tr>'
        f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="70PX">{code}</td>'
        f'<td style="VERTICAL-ALIGN:TOP;WHITE-SPACE:PRE-WRAP;" class="LC" width="180PX">{name}</td>'
        f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="20PX"><nobr dir="ltr">{credits}</nobr></td>'
        f'<td style="VERTICAL-ALIGN:TOP" class="LC" width="35PX">{state}</td>'
        f'<td style="VERTICAL-ALIGN:TOP">{sub}</td></tr></tbody></table>'
    )


# مشخصات: فیلدهای هویتی ساختگی، فیلدهای تحصیلی واقعی
INFO = (
    '<table style="BORDER-COLLAPSE: collapse; TABLE-LAYOUT: fixed" cellspacing="0" cellpadding="0" '
    'width="100%"><tbody><tr><td><table style="BORDER-COLLAPSE: collapse; FONT-FAMILY: '
    'Golestan Nazanin; TABLE-LAYOUT: fixed; FONT-SIZE: 11pt" width="100%"><tbody>'
    '<tr><td width="80" align="left"><strong>دانشكده</strong></td><td width="5">:&nbsp;</td>'
    '<td>مهندسي برق و كامپيوتر</td><td width="65" align="left"><strong>نام پدر</strong></td>'
    '<td width="5">:&nbsp;</td><td>—</td></tr>'
    '<tr><td align="left"><strong>گروه آموزشي</strong></td><td width="5">:&nbsp;</td><td>كامپيوتر</td>'
    '<td align="left"><strong>شماره ملي</strong></td><td width="5">:&nbsp;</td><td>0000000000</td></tr>'
    '<tr><td align="left"><strong>رشته</strong></td><td width="5">:&nbsp;</td><td>مهندسي كامپيوتر</td>'
    '<td align="left"><strong>شناسنامه</strong></td><td width="5">:&nbsp;</td><td>0000000000</td></tr>'
    '<tr><td align="left"><strong>مقطع</strong></td><td width="5">:&nbsp;</td><td>كارشناسي</td>'
    '<td align="left"><strong>محل صدور</strong></td><td width="5">:&nbsp;</td><td>—</td></tr>'
    '<tr><td align="left"><strong>دوره</strong></td><td width="5">:&nbsp;</td><td>روزانه</td>'
    '<td align="left"><strong>تاريخ تولد</strong></td><td width="5">:&nbsp;</td><td>—</td></tr>'
    '<tr><td align="left"><strong>معدل كل</strong></td><td width="5">:&nbsp;</td>'
    '<td><nobr dir="ltr">16/5</nobr></td><td align="left"><strong>واحد گذرانده</strong></td>'
    '<td width="5">:&nbsp;</td><td><nobr dir="ltr">120</nobr></td></tr>'
    '</tbody></table></td></tr></tbody></table>'
)

TOTALS = (
    '<table width="100%" cellspacing="0" cellpadding="0" style="TABLE-LAYOUT:FIXED;BORDER-COLLAPSE:'
    'COLLAPSE"><tbody><tr><td width="100%" valign="TOP" style="BORDER-COLLAPSE:COLLAPSE;BORDER:BLACK '
    '1PX SOLID"><table bgcolor="#AAAAFF" width="100%" style="TABLE-LAYOUT:FIXED;BORDER-COLLAPSE:'
    'COLLAPSE;FONT-FAMILY:Golestan Nazanin, Tahoma;FONT-SIZE:13px;"><tbody><tr>'
    '<td width="300PX" style="COLOR:RED"><b>واحد تطبيقي : </b><nobr dir="ltr">120</nobr> واحد از '
    '<nobr dir="ltr">140</nobr> تا <nobr dir="ltr">141</nobr> واحد برنامه </td>'
    '<td width="105PX"><b>واحد ناتمام :</b><nobr dir="ltr">1</nobr></td>'
    '<td width="121PX"><b>واحد باقيمانده :</b><nobr dir="ltr">19</nobr></td>'
    '</tr></tbody></table></td></tr></tbody></table>'
)

# (نام گروه, done/min/max درس, done/min/max واحد, قرمز, درس‌ها)
GROUPS = [
    ('دروس عمومي اجباري', (3, 3, 3), (8, 8, 8), False, [
        ('1111017', 'فارسي', 3, '4012', '17/5', 'عمومي'),
        ('1111018', 'زبان خارجي', 3, '4011', '18', 'عمومي'),
        ('1611022', 'دانش خانواده وجمعيت', 2, '4042', '20', 'عمومي'),
    ]),
    ('دروس عمومي گروه مباني نظري اسلام', (2, 2, 2), (4, 4, 4), False, [
        ('1611001', 'انديشه اسلامي يك - مبدا ومعاد', 2, '4022', '19', 'عمومي'),
        ('1611002', 'انديشه اسلامي دو- نبوت وامامت', 2, '4032', '20', 'عمومي'),
        ('1611003', 'انسان در اسلام', 2, None, None, None),
        ('1611020', 'حقوق سياسي -اجتماعي اسلام', 2, None, None, None),
    ]),
    ('دروس عمومي گروه اخلاق اسلامي', (1, 1, 1), (2, 2, 2), False, [
        ('1611004', 'اخلاق و تربيت اسلامي', 2, None, None, None),
        ('1611005', 'فلسفه اخلاق - با تكيه بر مباحث تربيتي', 2, None, None, None),
        ('1611006', 'اخلاق اسلامي - مباني ومفاهيم', 2, None, None, None),
        ('1611007', 'آيين زندگي - اخلاق كاربردي', 2, '4031', '18', 'عمومي'),
        ('1611023', 'عرفان عملي اسلام', 2, None, None, None),
    ]),
    ('دروس عمومي گروه تاريخ و تمدن اسلامي', (1, 1, 1), (2, 2, 2), False, [
        ('1611012', 'تاريخ فرهنگ وتمدن اسلامي', 2, None, None, None),
        ('1611013', 'تاريخ تحليلي صدر اسلام', 2, '4041', '19', 'عمومي'),
        ('1611014', 'تاريخ امامت', 2, None, None, None),
    ]),
    ('دروس عمومي گروه آشنايي با منابع اسلامي', (1, 1, 1), (2, 2, 2), False, [
        ('1611016', 'تفسير موضوعي قرآن', 2, '4012', '20', 'عمومي'),
        ('1611017', 'تفسير موضوعي نهج البلاغه - متون', 2, None, None, None),
    ]),
    ('دروس عمومي انقلاب اسلامي', (1, 1, 1), (2, 2, 2), False, [
        ('1611008', 'انقلاب اسلامي و ريشه هاي آن', 2, None, None, None),
        ('1611009', 'انقلاب اسلامي ايران', 2, '4011', '20', 'عمومي'),
        ('1611010', 'آشنائي با قانون اساسي جمهوري اسلامي ايران', 2, None, None, None),
        ('1611021', 'انديشه سياسي امام خميني', 2, None, None, None),
    ]),
    ('تربيت بدني  يك', (1, 1, 1), (1, 1, 1), False, [
        ('2911001', 'تربيت بدني', 1, '4022', '15', 'عمومي'),
    ]),
    ('تربيت بدني  دو', (1, 1, 1), (1, 1, 1), False, [
        ('2911002', 'ورزش 1', 1, '4031', '19', 'عمومي'),
    ]),
    ('دروس عمومي مازاد(با تاثير در معدل كل)', (0, 0, 2), (0, 0, 5), False, [
        ('1111031', 'آشنايي با دفاع مقدس (درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('1111040', 'مهارت هاي زندگي (درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('1111043', 'آشنائي با كليات حقوق شهروندي (درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('1111051', 'نگارش علمي (درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('1211083', 'هوش مصنوعي و تحول ديجيتال', 2, None, None, None),
        ('1411141', 'شناخت محيط زيست (درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('1411168', 'پدافندغيرعامل (درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('1611024', 'مكتب شهيد سليماني(درس عمومي، بدون تاثير در واحد گذرانده كل)', 2, None, None, None),
        ('2111002', 'سواد مالي و اقتصادي فردي(درس عمومي، بدون تاثير در واحد گذرانده كل )', 2, None, None, None),
        ('2111003', 'كارآفريني (درس عمومي، بدون تاثير در واحد گذرانده كل)', 3, None, None, None),
    ]),
    ('دروس عمومي مازاد(بدون تاثير در معدل كل)', (0, 0, 1), (0, 0, 2), False, [
        ('2111001', 'طرح كسب كار(درس عمومي، بدون تاثير در معدل كل و واحد گذرانده كل)', 2, None, None, None),
    ]),
    ('دروس پايه -مشترك', (8, 8, 8), (20, 20, 20), False, [
        ('1111001', 'رياضي عمومي 1', 3, '4011', '19/75', 'پايه'),
        ('1111002', 'رياضي عمومي 2', 3, '4021', '15/5', 'پايه'),
        ('1111003', 'فيزيك 1', 3, '4012', '19', 'پايه'),
        ('1111004', 'فيزيك 2', 3, '4021', '15/5', 'پايه'),
        ('1111006', 'ازمايشگاه فيزيك 2', 1, '4022', '17/5', 'پايه'),
        ('1111009', 'معادلات ديفرانسيل', 3, '4012', '16', 'پايه'),
        ('1211036', 'آمار و احتمالات مهندسي', 3, '4041', '14/5', 'پايه'),
        ('1221127', 'كارگاه آشنايي با مهندسي كامپيوتر', 1, '4021', '19/25', 'پايه'),
    ]),
    ('دروس اصلي-مشترك', (21, 24, 24), (55, 60, 60), True, [
        ('1211012', 'زبان تخصصي', 2, None, None, None),
        ('1214002', 'جبرخطي', 3, None, None, None),
        ('1221003', 'برنامه نويسي پيشرفته', 3, '4012', '19/25', 'اصلي'),
        ('1221005', 'ساختمان داده ها', 3, '4022', '15/2', 'اصلي'),
        ('1221008', 'طراحي الگوريتمها', 3, '4031', '13/16', 'اصلي'),
        ('1221009', 'نظريه زبانها و ماشينها', 3, '4031', '15/5', 'اصلي'),
        ('1221012', 'سيستمهاي عامل', 3, '4032', '12', 'اصلي'),
        ('1221013', 'شبكه هاي كامپيوتري', 3, '4041', '12', 'اصلي'),
        ('1221019', 'آزمايشگاه شبكه كامپيوتري', 1, None, None, None),
        ('1221029', 'پايگاه داده ها', 3, '4031', '16/19', 'اصلي'),
        ('1221031', 'زبان تخصصي', 2, '4032', '18/02', 'اصلي'),
        ('1221036', 'معماري كامپيوتر', 3, '4031', '17/8', 'اصلي'),
        ('1221046', 'مباني كامپيوتر و برنامه نويسي', 3, '4011', '11/3', 'اصلي'),
        ('1221047', 'رياضيات گسسته', 3, '4012', '17/25', 'اصلي'),
        ('1221050', 'مدارهاي منطقي', 3, '4022', '12', 'اصلي'),
        ('1221052', 'طراحي كامپيوتري سيستم هاي ديجيتال', 3, '4042', '15/96', 'اصلي'),
        ('1221055', 'اصول طراحي كامپايلر', 3, '4042', '11/5', 'اصلي'),
        ('1221056', 'آزمايشگاه سيستم هاي عامل', 1, None, None, None),
        ('1221057', 'آزمايشگاه مدارهاي منطقي و معماري كامپيوتر', 1, '4031', '20', 'اصلي'),
        ('1221058', 'روش پژوهش و ارايه', 2, '4042', '17/2', 'اصلي'),
        ('1221125', 'كارگاه مباني كامپيوتر و برنامه نويسي', 1, '4011', '20', 'اصلي'),
        ('1221128', 'كارگاه برنامه نويسي پيشرفته', 1, '4012', '20', 'اصلي'),
        ('1221129', 'مدارهاي الكتريكي و الكترونيكي', 3, '4042', '13', 'اصلي'),
        ('1221130', 'جبر خطي كاربردي', 3, '4031', '16/11', 'اصلي'),
        ('1221131', 'مباني و كاربردهاي هوش مصنوعي', 3, '4032', '12/5', 'اصلي'),
        ('1221132', 'پروژه پاياني', 3, None, None, None),
    ]),
    ('دروس اصلي(كارآموزي)-مشترك', (0, 1, 1), (0, 1, 1), True, [
        ('1221059', 'كارآموزي (مهندسي كامپيوتر)', 1, None, None, None),
    ]),
    ('دروس تخصصي مشترك همه گرايش هاي فرعي', (1, 0, 6), (3, 0, 11), False, [
        ('1111011', 'محاسبات عددي', 2, None, None, None),
        ('1211005', 'آزمايشگاه سيستمهاي كنترل خطي', 1, None, None, None),
        ('1211014', 'رياضي مهندسي', 3, None, None, None),
        ('1211025', 'سيستمهاي كنترل خطي', 3, None, None, None),
        ('1211043', 'اقتصادمهندسي', 3, None, None, None),
        ('1221018', 'آزمايشگاه الكترونيك ديجيتال', 1, None, None, None),
        ('1221020', 'مدارهاي منطقي پيشرفته', 3, None, None, None),
        ('1221022', 'گرافيك كامپيوتري', 3, None, None, None),
        ('1221024', 'سيگنالها و سيستمها', 3, '4042', '19/1', 'تخصصي'),
        ('1221101', 'نظريه و الگوريتمهاي گراف', 3, None, None, None),
        ('1221102', 'نظريه محاسبات', 3, None, None, None),
        ('1221104', 'الگوريتمهاي پيشرفته كارشناسي', 3, None, None, None),
        ('1221105', 'مقدمه اي بر مسابقات برنامه نويسي', 3, None, None, None),
        ('1221106', 'منطق در علوم و مهندسي كامپيوتر', 3, None, None, None),
        ('1221121', 'مباحث ويژه در كامپيوتر-1', 3, None, None, None),
        ('1221150', 'شبيه سازي كامپيوتري', 3, None, None, None),
        ('1221164', 'آزمايشگاه FPGA', 1, None, None, None),
    ]),
    ('دروس تخصصي طراحي و توسعه نرم افزار-گرايش اصلي', (5, 6, 10), (11, 16, 26), True, [
        ('1221035', 'مهندسي نرم افزار', 3, '4041', '16/2', 'تخصصي'),
        ('1221065', 'تحليل و طراحي سيستم هاي نرم افزاري', 3, '4032', '16/99', 'تخصصي'),
        ('1221096', 'طراحي زبانهاي برنامه سازي', 3, None, None, None),
        ('1221107', 'آزمايشگاه پايگاه داده', 1, '4041', '17', 'تخصصي'),
        ('1221120', 'آزمايشگاه مهندسي نرم افزار', 1, '4042', '20', 'تخصصي'),
        ('1221133', 'طراحي شي گراي سيستم ها', 3, None, None, None),
        ('1221134', 'آزمون نرم افزار', 3, None, None, None),
        ('1221135', 'برنامه نويسي چند هسته اي', 3, None, None, None),
        ('1221136', 'مباني بازيابي اطلاعات', 3, None, None, None),
        ('1221138', 'برنامه نويسي وب و دستگاههاي سيار', 3, '4021', '20', 'تخصصي'),
    ]),
    ('گرايش 18-دروس تخصصي فرعي:هوش مصنوعي', (2, 3, 9), (6, 7, 18), True, [
        ('1221103', 'مباني نظريه بازي ها', 3, '4041', '13/95', 'تخصصي'),
        ('1221108', 'كارگاه برنامه نويسي متلب', 1, None, None, None),
        ('1221115', 'مباني هوش محاسباتي', 3, None, None, None),
        ('1221117', 'مباني داده كاوي', 3, '4042', '18/1', 'تخصصي'),
        ('1221144', 'اصول رباتيك', 3, None, None, None),
        ('1221145', 'مقدمه اي بر بيوانفورماتيك', 3, None, None, None),
        ('1221147', 'مباني بينايي كامپيوتر', 3, None, None, None),
        ('1221148', 'كارگاه ساخت ربات', 1, None, None, None),
    ]),
    ('گرايش 18-دروس اختياري مشترك تخصص فرعي هوش م.', (1, 0, 11), (3, 0, 11), False, [
        ('1212089', 'طراحي سيستم هاي ريز پردازنده اي', 3, None, None, None),
        ('1221010', 'الكترونيك ديجيتال', 3, None, None, None),
        ('1221016', 'طراحي سيستمهاي مجتمع پرتراكم', 3, None, None, None),
        ('1221017', 'انتقال داده ها', 3, None, None, None),
        ('1221034', 'طراحي مدارهاي واسط', 3, None, None, None),
        ('1221053', 'ريز پردازنده و زبان اسمبلي', 3, None, None, None),
        ('1221063', 'سيستمهاي چند رسانه اي', 3, None, None, None),
        ('1221097', 'هم طراحي سخت افزار - نرم افزار', 3, None, None, None),
        ('1221098', 'سيستمهاي نهفته و بيدرنگ', 3, '4041', '19/25', 'تخصصي اختياري'),
        ('1221137', 'آزمايشگاه مدارهاي الكتريكي و الكترونيكي', 1, None, None, None),
        ('1221139', 'مباني رايانش امن', 3, None, None, None),
        ('1221140', 'مباني رايانش ابري', 3, None, None, None),
        ('1221141', 'مباني اينترنت اشياء', 3, None, None, None),
        ('1221142', 'مباني شبكه هاي بيسيم', 3, None, None, None),
        ('1221143', 'آزمايشگاه اينترنت اشياء', 1, None, None, None),
        ('1221149', 'آزمايشگاه ريزپردازنده و زبان اسمبلي', 1, None, None, None),
    ]),
    ('گرايش 18-دروس اختياري تخصص فرعي هوش م.-از كارشناسي ساير رشته ها', (0, 0, 1), (0, 0, 3), False, []),
    ('گرايش 18-دروس اختياري تخصص فرعي هوش م.-از ارشد مهندسي كامپيوتر', (0, 0, 1), (0, 0, 3), False, [
        ('1221112', 'داده كاوي', 3, None, None, None),
        ('1221126', 'پايگاه داده هاي پيشرفته', 3, None, None, None),
    ]),
    ('گروه مرتبط با دروس تخصصي، اختياري همه بسته هاي تخصصي گرايشي', (9, 0, 20), (23, 0, 38), False, []),
    ('گروه هاي فرعي', (9, 9, 38), (23, 23, 72), False, []),
]

rows = [
    '<tr class="DTitle">\n<td>شماره دانشجو</td>\n<td>نام و نام خانوادگي</td>\n<td></td>\n<td></td>\n<td></td>\n</tr>',
    ROW.format(payload=INFO),
    ROW.format(payload=TOTALS),
]
for name, (dc, mnc, mxc), (du, mnu, mxu), red, courses in GROUPS:
    rows.append(ROW.format(payload=group_header(name, dc, mnc, mxc, du, mnu, mxu, red)))
    for c in courses:
        rows.append(ROW.format(payload=course(*c)))

html = ('<table border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse">\n'
        '<tbody>' + '\n'.join(rows) + '</tbody></table>\n')
io.open(OUT, 'w', encoding='utf-8').write(html)
groups = len(GROUPS)
courses = sum(len(g[4]) for g in GROUPS)
passed = sum(1 for g in GROUPS for c in g[4] if c[4] is not None)
print(f'{OUT}: {groups} groups, {courses} course rows, {passed} passed')
