"""Monthly: read the planted-tree count from the Ecodrive impact badge and update the homepage tree card (EN + DE).
The badge is an SVG that browsers may not read (CORS), so this runs on GitHub Actions instead."""
import re, sys, datetime, urllib.request

BADGE = ('https://ij0mlb3e7b.execute-api.us-east-1.amazonaws.com/Prod/impact-badge?businessId=76b63279-46c8-4c66-8fd9-820387ec0dbe'
         '&orientation=vertical&mainData=trees&treesData=t&plasticData=&kelpData=')
MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
PAGES = {
    'index.html': (r'<b>(\d+)</b> trees planted so far \(([A-Za-z]+ \d{4})\)', '<b>{n}</b> trees planted so far ({month})', 'en'),
    'de/index.html': (r'<b>(\d+)</b> Bäume bisher gepflanzt \(([^)]+ \d{4})\)', '<b>{n}</b> Bäume bisher gepflanzt ({month})', 'de'),
}

svg = urllib.request.urlopen(urllib.request.Request(BADGE, headers={'User-Agent': 'flywithmiki-site-updater'}), timeout=60).read().decode('utf-8', 'replace')
m = re.search(r'>(\d+)</text>\s*<text[^>]*>\s*Trees Planted', svg)
if not m:
    sys.exit('tree count not found in the badge; nothing changed')
count = int(m.group(1))
today = datetime.date.today()
changed = False
for path, (pattern, template, lang) in PAGES.items():
    html = open(path, encoding='utf-8', newline='').read()
    cur = re.search(pattern, html)
    if not cur:
        sys.exit(f'tree card not found in {path}; nothing changed')
    if int(cur.group(1)) >= count:
        continue  # never lower the number because of a hiccup on their side
    month = f'{today.strftime("%B")} {today.year}' if lang == 'en' else f'{MONTHS_DE[today.month - 1]} {today.year}'
    html = html.replace(cur.group(0), template.format(n=count, month=month), 1)
    open(path, 'w', encoding='utf-8', newline='').write(html)
    changed = True
    print(f'{path}: {cur.group(1)} -> {count} ({month})')
print('updated' if changed else f'no change ({count} trees)')
