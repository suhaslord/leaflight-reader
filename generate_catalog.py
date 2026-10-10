import csv,gzip,io,json,re,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).parent
url='https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz'
print('Downloading Project Gutenberg official catalog...',flush=True)
raw=urllib.request.urlopen(url,timeout=40).read()
reader=csv.DictReader(io.StringIO(gzip.decompress(raw).decode('utf-8-sig')))
base={}
for row in reader:
    if 'en' not in row.get('Language','').split(';'):continue
    if row.get('Type','')!='Text':continue
    try:bookid=int(row['Text#'])
    except:continue
    title=re.sub(r'\s+',' ',row.get('Title','')).strip()
    if not title:continue
    author=re.sub(r'\s+',' ',row.get('Authors','').split(';')[0]).strip()
    subjects=(row.get('Subjects','')+'; '+row.get('Bookshelves','')).strip()
    normalized=subjects.lower()
    tags=0
    for i,terms in enumerate([['fiction','novel','short stories'],['adventure'],['mystery','detective'],['science fiction','science-fiction'],['romance','love stories'],['poetry','poems'],['history','historical']]):
        if any(term in normalized for term in terms):tags|=(1<<i)
    base[bookid]=[bookid,title[:220],author[:100],subjects[:170],tags,'']
print('Eligible catalog entries:',len(base),flush=True)
def top_page(n):
    request=urllib.request.Request('https://gutendex.com/books/?languages=en&page='+str(n),headers={'User-Agent':'Mozilla/5.0'})
    try:return json.load(urllib.request.urlopen(request,timeout=20)).get('results',[])
    except Exception as e:print('Top-page error',n,str(e)[:80],flush=True);return []
tops=[]
with ThreadPoolExecutor(max_workers=3) as pool:
    for chunk in pool.map(top_page,range(1,9)):
        tops.extend(chunk)
print('Popular entries:',len(tops),flush=True)
special=[]
seen=set()
for b in tops:
    bid=int(b['id'])
    if b.get('copyright',False) or bid in seen or bid not in base:continue
    seen.add(bid)
    row=base[bid]
    row[5]=b.get('formats',{}).get('image/jpeg','')
    special.append(row)
# The rest are sorted by Gutenberg ID, preserving long tail historic classics.
others=[item for bid,item in base.items() if bid not in seen]
others.sort(key=lambda x:x[0])
allbooks=special+others
(root/'data').mkdir(exist_ok=True)
out=root/'data'/'catalog.json'
out.write_text(json.dumps(allbooks,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Wrote',len(allbooks),'books',out.stat().st_size,'bytes',flush=True)
print('First ten:',[(r[0],r[1][:22]) for r in allbooks[:10]],flush=True)
