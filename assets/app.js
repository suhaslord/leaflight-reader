'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STORAGE = 'leaflight.v1.';
const safeGet = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(STORAGE + key)); return v === null ? fallback : v; } catch { return fallback; } };
const safeSet = (key, value) => { try { localStorage.setItem(STORAGE + key, JSON.stringify(value)); } catch {} };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const validBook = b => b && typeof b==='object' && Number.isSafeInteger(Number(b.id)) && Number(b.id)>0 && typeof b.title==='string' && b.title.length>0;
const safeMap = (key,validate) => {
  const raw=safeGet(key,{});
  if(!raw || typeof raw!=='object'||Array.isArray(raw))return {};
  return Object.fromEntries(Object.entries(raw).slice(0,600).filter(([id,value])=>/^\d{1,7}$/.test(id)&&validate(value)));
};
const rawLast=safeGet('last',null);
const state = { page:'home', topic:'', query:'', pageNo:1, next:false, books:[], recommendations:[], request:0, pending:null, readerId:null,
  saved:safeMap('saved',validBook),
  history:safeMap('history',v=>v&&validBook(v.book)&&Number.isFinite(Number(v.progress))),
  last:rawLast&&validBook(rawLast.book)?rawLast:null,
  settings:safeGet('settings',{size:19,font:'serif',theme:'paper'})
};
const palette=[['#47655b','#243e36'],['#a16e61','#603f46'],['#7291a0','#354e62'],['#9b8b65','#5b533e'],['#777b9c','#42445d'],['#8c7c70','#58443a'],['#8e9b71','#536545']];
let toastTimer, scrollTick=false, inputTimer, readerSession=0, readerRequest=null, readerTrigger=null, readerReflowProgress=null, readerReflowToken=0, readerReflowTimer=null;
function authors(book){ return (book.authors||[]).map(a=>a.name).join(', ') || 'Unknown author'; }
function normalize(book){
  const b=book&&typeof book==='object'?book:{};
  return {id:Number(b.id),title:String(b.title||'Untitled').slice(0,240),
    authors:(Array.isArray(b.authors)?b.authors:[]).slice(0,8).map(a=>({name:String(a?.name||'').slice(0,100)})),
    image:typeof b.image==='string'?b.image:'',
    downloads:Number(b.downloads)||0,
    languages:Array.isArray(b.languages)?b.languages:[],
    subjects:Array.isArray(b.subjects)?b.subjects:[]};
}
function unique(books){const seen=new Set();return books.filter(b=>b&&b.id&&!seen.has(b.id)&&seen.add(b.id));}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2600);}
function updateSavedCount(){ $('#savedCount').textContent=Object.keys(state.saved).length; }
function bookById(id){return state.books.find(b=>b.id===id)||state.recommendations.find(b=>b.id===id)||state.saved[id]||state.history[id]?.book||state.last?.book||null;}
function isSaved(id){return !!state.saved[id];}
function updateNav(){ $$('.nav-link,.mobile-link').forEach(el=>{const active=el.dataset.page===state.page;el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');}); const labels={home:'Home',explore:'Discover',library:'My library'};$('#breadcrumb').innerHTML='Your space <span>/</span> '+labels[state.page]; }
function syncChips(){
  $$('.chip').forEach(btn=>{
    const active=btn.dataset.topic===state.topic;
    btn.classList.toggle('selected',active);
    btn.setAttribute('aria-pressed',String(active));
  });
}
function setPage(page,opts={}){
  if(page==='home'){
    clearTimeout(inputTimer);
    state.query='';state.topic='';
    $('#searchInput').value='';
    syncChips();
  }else if(page==='library'){clearTimeout(inputTimer);}
  state.page=page; updateNav();const home=page==='home'; $('#hero').hidden=!home;$('#aiConcierge').hidden=page==='library';$('#viewAll').hidden=!home;$('#filters').hidden=page==='library';$('#continueBanner').hidden=!home||!state.last;
  if(page==='library'){$('#sectionEyebrow').innerHTML='<span class="tiny-star">✦</span> BOOKS YOU LOVE';$('#sectionTitle').innerHTML='Your little library <span class="title-swirl">↝</span>';$('#sectionSubtitle').textContent='Your saved stories, always one click away.';state.query='';$('#searchInput').value='';renderSaved();}
  else {$('#sectionEyebrow').innerHTML='<span class="tiny-star">✦</span> '+(home?'HANDPICKED FOR YOU':'EXPLORE THE COLLECTION');$('#sectionTitle').innerHTML=state.query?'Search results <span class="title-swirl">↝</span>':home?'The reading room <span class="title-swirl">↝</span>':'Find something wonderful <span class="title-swirl">↝</span>';$('#sectionSubtitle').textContent=state.query?('Books matching “'+state.query+'”'):(home?'Wonderful books that have stood the test of time.':'A world of stories, just waiting to be opened.');loadBooks(false);}
  if(!opts.noScroll) window.scrollTo({top:0,behavior:'smooth'});
}
function cover(book){const [a,b]=palette[book.id%palette.length],url=/^https:\/\/(www\.)?gutenberg\.org\//.test(book.image)?book.image:'',title=esc(book.title),author=esc(authors(book));return '<div class="book-cover" style="--cover-a:'+a+';--cover-b:'+b+'"><div class="fallback-cover"><span class="fallback-top">LEAFLIGHT EDITION</span><span class="fallback-title">'+title+'</span><span class="fallback-bottom">'+author+'</span></div>'+(url?'<img loading="lazy" alt="" src="'+esc(url)+'">':'')+'</div>';}
function card(book){const progress=state.history[book.id]?.progress||0;return '<article class="book-card"><button class="book-cover-button" data-open="'+book.id+'" aria-label="Read '+esc(book.title)+'">'+cover(book)+'</button><button class="card-save '+(isSaved(book.id)?'saved':'')+'" data-save="'+book.id+'" title="'+(isSaved(book.id)?'Remove from library':'Save to library')+'" aria-label="'+(isSaved(book.id)?'Remove ':'Save ')+esc(book.title)+'" aria-pressed="'+isSaved(book.id)+'"><svg><use href="#ico-heart"/></svg></button><div class="book-meta"><h3>'+esc(book.title)+'</h3><p>'+esc(authors(book))+'</p>'+(progress>0?'<div class="book-progress" title="'+Math.round(progress*100)+'% read"><div style="width:'+Math.round(progress*100)+'%"></div></div>':'')+'</div></article>';}
function attachImageFallbacks(){ $$('#booksGrid img,#aiResults img').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true})); }
function renderBooks(){ $('#booksGrid').innerHTML=state.books.map(card).join('');attachImageFallbacks();const none=state.books.length===0;$('#gridStatus').hidden=!none;if(none) $('#gridStatus').innerHTML='<h3>No books on this shelf yet</h3><p>Try a different search or explore another category.</p><button data-reset="true">Browse all books</button>';$('#loadMore').hidden=!state.next||none; }
function renderSaved(){if(state.pending)state.pending.abort();state.books=Object.values(state.saved).reverse().map(normalize);state.next=false;renderBooks();if(state.books.length===0){$('#gridStatus').innerHTML='<h3>A story starts here.</h3><p>Tap the heart on any book to keep it in your library.</p><button data-reset="true">Explore books</button>';}}
function showError(){ $('#booksGrid').innerHTML='';$('#loadMore').hidden=true;$('#gridStatus').hidden=false;$('#gridStatus').innerHTML='<h3>Our shelves are taking a moment.</h3><p>We could not reach the book catalog right now. Check your connection and try again.</p><button data-retry="true">Try again</button>';}
async function loadBooks(append=false){if(state.page==='library')return;if(state.pending)state.pending.abort();const controller=new AbortController();state.pending=controller;const reqId=++state.request;const page=append?state.pageNo+1:1;if(!append){$('#booksGrid').innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';$('#gridStatus').hidden=true;}else{$('#loadMore').disabled=true;$('#loadMore').textContent='Loading books…';}
  const params=new URLSearchParams({page:String(page)});if(state.topic)params.set('topic',state.topic);if(state.query)params.set('search',state.query);
  try{const response=await fetch('/api/books?'+params,{signal:controller.signal});if(!response.ok)throw new Error('Catalog request failed');const data=await response.json();if(!Array.isArray(data.results))throw new Error('Invalid catalog response');if(reqId!==state.request||state.page==='library')return;state.books=append?unique([...state.books,...data.results.map(normalize)]):unique(data.results.map(normalize));state.pageNo=page;state.next=!!data.next;renderBooks();}
  catch(e){if(e.name!=='AbortError'&&reqId===state.request)showError();}
  finally{if(reqId===state.request){state.pending=null;$('#loadMore').disabled=false;$('#loadMore').innerHTML='Show more books <span>↓</span>';}}
}
function toggleSave(id){const book=bookById(id);if(!book)return;if(isSaved(id)){delete state.saved[id];toast('Removed from your library');}else{state.saved[id]=normalize(book);toast('Added to your library');}safeSet('saved',state.saved);updateSavedCount();if(state.page==='library')renderSaved();else renderBooks();renderAIResults();syncReaderSave();}
function syncReaderSave(){if(state.readerId===null)return;const saved=isSaved(state.readerId);$('#readerSave').classList.toggle('is-saved',saved);$('#readerSave').setAttribute('aria-label',saved?'Remove from library':'Save to library');}
function renderContinue(){const last=state.last;$('#continueBanner').hidden=!last||state.page!=='home';if(last){$('#continueTitle').textContent=last.book.title;$('#continueMeta').textContent=Math.round((state.history[last.book.id]?.progress||0)*100)+'% completed';}}
function setTopic(topic){state.topic=topic;syncChips();state.query='';$('#searchInput').value='';setPage('explore',{noScroll:true});}
function readSettings(){
  if(!state.settings||typeof state.settings!=='object'||Array.isArray(state.settings))state.settings={};
  const s=state.settings;
  s.size=Math.max(15,Math.min(28,Number(s.size)||19));
  s.font=['serif','sans'].includes(s.font)?s.font:'serif';
  s.theme=['paper','sepia','night'].includes(s.theme)?s.theme:'paper';
  s.spacing=['compact','comfortable','airy'].includes(s.spacing)?s.spacing:'comfortable';
  s.width=['narrow','standard','wide'].includes(s.width)?s.width:'standard';
  const reader=$('#reader'),scroll=$('#readerScroll');
  const preserve=!reader.hidden && Boolean($('#readerDocument .reader-text'));
  const oldMax=Math.max(0,scroll.scrollHeight-scroll.clientHeight);
  const ratio=readerReflowProgress!==null?readerReflowProgress:(oldMax?Math.max(0,Math.min(1,scroll.scrollTop/oldMax)):0);
  reader.dataset.font=s.font;reader.dataset.theme=s.theme;
  reader.dataset.spacing=s.spacing;reader.dataset.width=s.width;
  $('#readerDocument').style.fontSize=s.size+'px';
  $('#fontSize').textContent=s.size+'px';
  for(const type of ['font','theme','spacing','width']){
    $$('.reader-settings button[data-'+type+']').forEach(el=>{
      const current=el.dataset[type]===s[type];
      el.classList.toggle('active',current);
      el.setAttribute('aria-pressed',String(current));
    });
  }
  safeSet('settings',s);
  if(preserve){
    readerReflowProgress=ratio;
    const token=++readerReflowToken;
    clearTimeout(readerReflowTimer);
    const restore=()=>{
      if(token!==readerReflowToken||reader.hidden||!$('#readerDocument .reader-text'))return;
      scroll.scrollTop=ratio*Math.max(0,scroll.scrollHeight-scroll.clientHeight);
    };
    requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});
    readerReflowTimer=setTimeout(()=>{
      if(token!==readerReflowToken)return;
      restore();
      readerReflowProgress=null;
      updateProgress();
    },240);
  }
}
function updateBookmarkAction(){
  if(state.readerId===null){$('#jumpBookmark').hidden=true;return;}
  const saved=safeGet('bookmark.'+state.readerId,null);
  $('#jumpBookmark').hidden=typeof saved!=='number'||!Number.isFinite(saved);
}
function jumpBookmark(){
  if(state.readerId===null)return;
  const position=safeGet('bookmark.'+state.readerId,null);
  if(typeof position!=='number'||!Number.isFinite(position))return;
  const el=$('#readerScroll');
  el.scrollTop=Math.max(0,Math.min(1,position))*Math.max(0,el.scrollHeight-el.clientHeight);
  updateProgress();toast('Back to your bookmark');
}
function setReaderError(id){const doc=$('#readerDocument');doc.replaceChildren();const div=document.createElement('div');div.className='reading-error';const h=document.createElement('h2');h.textContent='This edition could not be opened right now.';const p=document.createElement('p');p.textContent='Some older books have formats that are unavailable in the built-in reader. You can still read the original edition at Project Gutenberg.';const a=document.createElement('a');a.href='https://www.gutenberg.org/ebooks/'+id;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open the original book ↗';div.append(h,p,a);doc.append(div);}
async function openReader(id){
  const book=bookById(id);
  if(!book){toast('This book is unavailable. Try searching for it again.');return;}
  if(readerRequest)readerRequest.abort();
  const session=++readerSession;
  readerReflowProgress=null;readerReflowToken++;clearTimeout(readerReflowTimer);
  readerRequest=new AbortController();
  readerTrigger=document.activeElement;
  state.readerId=id;
  state.last={book:normalize(book),opened:Date.now()};
  safeSet('last',state.last);
  if(!state.history[id])state.history[id]={book:normalize(book),progress:0};
  safeSet('history',state.history);
  renderContinue();
  $('#readerTitle').textContent=book.title;
  $('#readerAuthor').textContent=authors(book);
  const source='https://www.gutenberg.org/ebooks/'+id;
  $('#sourceLink').href=source;
  $('#readerSourceTop').href=source;
  $('#reader').hidden=false;
  document.body.style.overflow='hidden';
  $('.shell').inert=true;
  $('.mobile-nav').inert=true;
  $('#readerSettings').hidden=true;
  $('#readerDocument').innerHTML='<div class="reading-loading"><div class="loading-circle"></div><p>Opening your book…</p></div>';
  $('#readerScroll').scrollTop=0;
  $('#readerProgress').textContent='0% read';
  $('#readerProgressBar').style.width='0%';
  $('#readerSeek').value=0;
  $('#readerSeek').disabled=true;
  $('#previousPage').disabled=true;
  $('#nextPage').disabled=true;
  syncReaderSave();
  updateBookmarkAction();
  readSettings();
  $('#closeReader').focus();
  try{
    const response=await fetch('/api/read?id='+encodeURIComponent(id),{signal:readerRequest.signal});
    if(!response.ok)throw Error('Reader unavailable');
    const content=await response.text();
    if(session!==readerSession||state.readerId!==id)return;
    if(!content.trim())throw Error('Empty book');
    const doc=$('#readerDocument');
    doc.replaceChildren();
    const title=document.createElement('h1');
    title.textContent=book.title;
    const byline=document.createElement('p');
    byline.className='book-byline';
    byline.textContent='by '+authors(book);
    const notice=document.createElement('p');
    notice.className='reader-notice';
    notice.textContent='This full-text edition comes from Project Gutenberg. Original notices and license information are preserved. Copyright rules vary by country.';
    const text=document.createElement('div');
    text.className='reader-text';
    text.textContent=content.replace(/\r\n?/g,'\n');
    doc.append(title,byline,notice,text);
    $('#readerSeek').disabled=false;
    $('#previousPage').disabled=false;
    $('#nextPage').disabled=false;
    requestAnimationFrame(()=>{
      if(session!==readerSession||state.readerId!==id)return;
      const el=$('#readerScroll');
      const saved=Math.max(0,Math.min(1,Number(state.history[id]?.progress)||0));
      el.scrollTop=saved*Math.max(0,el.scrollHeight-el.clientHeight);
      updateProgress();
    });
  }catch(error){
    if(session===readerSession&&state.readerId===id&&error.name!=='AbortError')setReaderError(id);
  }
}
function updateProgress(){
  if(state.readerId===null||readerReflowProgress!==null)return;
  const el=$('#readerScroll');
  if(!el.querySelector('.reader-text'))return;
  const max=Math.max(0,el.scrollHeight-el.clientHeight);
  const progress=max>0?Math.max(0,Math.min(1,el.scrollTop/max)):1;
  const percent=Math.round(progress*100);
  $('#readerProgressBar').style.width=(progress*100).toFixed(1)+'%';
  $('#readerProgress').textContent=percent+'% read';
  $('#readerSeek').value=percent;
  $('#readerSeek').style.setProperty('--seek',percent+'%');
  $('#readerSeek').setAttribute('aria-valuetext',percent+' percent read');
  const id=state.readerId;
  state.history[id]={book:state.history[id]?.book||bookById(id),progress};
  safeSet('history',state.history);
  renderContinue();
}
function movePage(direction){
  readerReflowProgress=null;readerReflowToken++;clearTimeout(readerReflowTimer);
  const scroll=$('#readerScroll');
  if(!scroll.querySelector('.reader-text'))return;
  scroll.scrollTop=Math.max(0,Math.min(scroll.scrollHeight-scroll.clientHeight,
    scroll.scrollTop+direction*scroll.clientHeight*.87));
  updateProgress();
}
function seekReader(value){
  readerReflowProgress=null;readerReflowToken++;clearTimeout(readerReflowTimer);
  if(state.readerId===null||!$('#readerDocument .reader-text'))return;
  const el=$('#readerScroll'),p=Math.max(0,Math.min(100,Number(value)||0))/100;
  el.scrollTop=p*Math.max(0,el.scrollHeight-el.clientHeight);
  updateProgress();
}
function closeReader(){
  if($('#reader').hidden)return;
  readerReflowProgress=null;readerReflowToken++;clearTimeout(readerReflowTimer);
  updateProgress();
  const id=state.readerId;
  readerSession++;
  if(readerRequest){readerRequest.abort();readerRequest=null;}
  state.readerId=null;
  $('#reader').hidden=true;
  $('#readerSettings').hidden=true;
  document.body.style.overflow='';
  $('.shell').inert=false;
  $('.mobile-nav').inert=false;
  if(state.page==='library')renderSaved();
  else if(state.books.length)renderBooks();
  renderContinue();
  const toFocus=readerTrigger?.isConnected?readerTrigger:
    document.querySelector('[data-open="'+id+'"]')||$('#continueButton')||$('#brandLink');
  if(toFocus&&typeof toFocus.focus==='function')toFocus.focus({preventScroll:true});
  readerTrigger=null;
}
function bookmark(){
  if(state.readerId===null)return;
  updateProgress();
  const id=state.readerId,progress=state.history[id]?.progress||0;
  safeSet('bookmark.'+id,progress);
  updateBookmarkAction();
  toast('Your place has been saved');
}
$$('[data-page]').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));
$('#brandLink').addEventListener('click',e=>{e.preventDefault();setPage('home');});
$('#heroExplore').addEventListener('click',()=>setPage('explore'));
$('#viewAll').addEventListener('click',()=>setPage('explore'));
$('#libraryShortcut').addEventListener('click',()=>setPage('library'));
$('#loadMore').addEventListener('click',()=>loadBooks(true));
$('#filters').addEventListener('click',e=>{const chip=e.target.closest('.chip');if(chip)setTopic(chip.dataset.topic);});
function onBookCardClick(e){const save=e.target.closest('[data-save]');if(save){toggleSave(Number(save.dataset.save));return;}const open=e.target.closest('[data-open]');if(open)openReader(Number(open.dataset.open));}
$('#booksGrid').addEventListener('click',onBookCardClick);
$('#aiResults').addEventListener('click',onBookCardClick);
$('#gridStatus').addEventListener('click',e=>{if(e.target.closest('[data-retry]'))loadBooks();if(e.target.closest('[data-reset]')){state.topic='';setTopic('');}});
$('#searchForm').addEventListener('submit',e=>{e.preventDefault();clearTimeout(inputTimer);state.query=$('#searchInput').value.trim();state.topic='';syncChips();setPage('explore');});
$('#searchInput').addEventListener('input',()=>{clearTimeout(inputTimer);inputTimer=setTimeout(()=>{const query=$('#searchInput').value.trim();if(query.length===0&&state.query.length===0)return;state.query=query;state.topic='';syncChips();setPage('explore',{noScroll:true});},550);});
$('#continueButton').addEventListener('click',()=>{if(state.last)openReader(state.last.book.id);});
$('#closeReader').addEventListener('click',closeReader);
$('#readerSave').addEventListener('click',()=>{if(state.readerId!==null)toggleSave(state.readerId);});
$('#toggleSettings').addEventListener('click',()=>{$('#readerSettings').hidden=!$('#readerSettings').hidden;});
$('#fontSmaller').addEventListener('click',()=>{state.settings.size=Math.max(15,Number(state.settings.size)-1);readSettings();});
$('#fontLarger').addEventListener('click',()=>{state.settings.size=Math.min(28,Number(state.settings.size)+1);readSettings();});
$('#previousPage').addEventListener('click',()=>movePage(-1));
$('#nextPage').addEventListener('click',()=>movePage(1));
$('#readerSeek').addEventListener('input',e=>seekReader(e.target.value));
$('#readerSeek').addEventListener('change',e=>seekReader(e.target.value));
for(const type of ['spacing','width']){
  $$('[data-'+type+']').forEach(b=>b.addEventListener('click',()=>{
    state.settings[type]=b.dataset[type];readSettings();
  }));
}
$$('[data-font]').forEach(b=>b.addEventListener('click',()=>{state.settings.font=b.dataset.font;readSettings();}));
$$('[data-theme]').forEach(b=>b.addEventListener('click',()=>{state.settings.theme=b.dataset.theme;readSettings();}));
$('#bookmarkPosition').addEventListener('click',bookmark);
$('#jumpBookmark').addEventListener('click',jumpBookmark);
$('#readerScroll').addEventListener('scroll',()=>{if(scrollTick)return;scrollTick=true;requestAnimationFrame(()=>{scrollTick=false;updateProgress();});},{passive:true});
document.addEventListener('keydown',e=>{
  if($('#reader').hidden)return;
  if(e.key==='Escape'){
    e.preventDefault();
    if(!$('#readerSettings').hidden){$('#readerSettings').hidden=true;$('#toggleSettings').focus();}
    else closeReader();
    return;
  }
  if(e.key==='Tab'){
    const items=[...$('#reader').querySelectorAll('a[href],button:not([disabled]),input:not([disabled])')]
      .filter(el=>el.getClientRects().length>0);
    const first=items[0],last=items[items.length-1];
    if(!items.includes(document.activeElement)){e.preventDefault();first?.focus();}
    else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    return;
  }
  if(['ArrowLeft','ArrowRight'].includes(e.key)&&!e.altKey&&!e.metaKey&&!e.ctrlKey &&
    !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
    e.preventDefault();movePage(e.key==='ArrowRight'?1:-1);
  }
});
document.addEventListener('click',e=>{if(!$('#readerSettings').hidden&&!e.target.closest('#readerSettings,#toggleSettings'))$('#readerSettings').hidden=true;});

let aiPicks=[],aiBusy=false;
function renderAIResults(){
  const parent=$('#aiResults');
  parent.innerHTML=aiPicks.map(({book,reason})=>'<div class="ai-pick">'+card(book)+'<p class="ai-reason">'+esc(reason)+'</p></div>').join('');
  attachImageFallbacks();
}
async function askBookGuide(prompt){
  if(aiBusy)return;
  const text=String(prompt||'').trim();
  if(text.length<3){toast('Tell me a little about what you want to read.');$('#aiPrompt').focus();return;}
  aiBusy=true;
  $('#aiPrompt').value=text;
  const button=$('#aiSubmit');
  button.disabled=true;
  button.querySelector('span').textContent='Finding your story…';
  $('#aiResponse').hidden=false;
  $('#aiResponseTitle').textContent='Finding your next favorite…';
  $('#aiIntro').textContent='Looking through thousands of stories for you.';
  $('#aiResults').innerHTML='<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
  try{
    const response=await fetch('/api/recommend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:text})});
    if(!response.ok)throw Error('Could not find matches');
    const data=await response.json();
    if(!Array.isArray(data.picks)||!data.picks.length)throw Error('No matches yet');
    aiPicks=data.picks.map(p=>({book:normalize(p.book),reason:String(p.reason||'A thoughtful match for your interests.')}));
    state.recommendations=aiPicks.map(p=>p.book);
    $('#aiResponseTitle').textContent='A little list, just for you.';
    $('#aiIntro').textContent=data.intro||'Here are a few books that fit your mood.';
    $('#aiResponseTag').textContent=data.mode==='ai'?'AI recommendations':'Smart book matching';
    if(data.mode==='ai')$('#aiMode').textContent='✦ AI connected';
    renderAIResults();
  }catch{
    aiPicks=[];state.recommendations=[];
    $('#aiResponseTitle').textContent='Could not find your book yet';
    $('#aiIntro').textContent='Something interrupted the search. Try again in a moment.';
    $('#aiResults').innerHTML='';
  }finally{aiBusy=false;button.disabled=false;button.querySelector('span').textContent='Find my book';}
}
$('#aiForm').addEventListener('submit',e=>{e.preventDefault();askBookGuide($('#aiPrompt').value);});
$$('[data-ai-prompt]').forEach(el=>el.addEventListener('click',()=>askBookGuide(el.dataset.aiPrompt)));

updateSavedCount();renderContinue();setPage('home',{noScroll:true});
