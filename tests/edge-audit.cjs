'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const TEXT=('It was the best of times, and it was the strangest of days. '.repeat(22)+'\n\n').repeat(600);
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let pass=0,fail=0;
const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.log('FAIL',name,String(e.message).slice(0,480))}};
try{
 const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:TEXT}));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#booksGrid .book-card').first().waitFor();
 await check('Returning home resets search, active category and query',async()=>{
  await page.locator('#searchInput').fill('frankenstein');await page.locator('#searchInput').press('Enter');
  await page.locator('#booksGrid .book-card').first().waitFor();
  await page.locator('#brandLink').click();await page.locator('#booksGrid .book-card').first().waitFor();
  assert.equal(await page.locator('#booksGrid .book-card').count(),25);assert.equal(await page.locator('#searchInput').inputValue(),'');assert.equal(await page.locator('[data-topic=""]').getAttribute('aria-pressed'),'true');
 });
 await check('All genre buttons have truthful accessibility states',async()=>{
  await page.locator('[data-topic="Mystery"]').click();await page.locator('#booksGrid .book-card').first().waitFor();
  await page.locator('#searchInput').fill('alice');await page.locator('#searchInput').press('Enter');
  assert.equal(await page.locator('[data-topic="Mystery"]').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('[data-topic=""]').getAttribute('aria-pressed'),'true');
 });
 await page.locator('#brandLink').click();await page.locator('#booksGrid .book-card').first().waitFor();
 await page.locator('#booksGrid [data-open]').first().click();await page.locator('.reader-text').waitFor({timeout:15000});
 await check('Progress slider jumps to exact spot',async()=>{
   await page.locator('#readerSeek').fill('62');await page.waitForTimeout(100);
   const value=parseInt(await page.locator('#readerProgress').innerText());assert.ok(Math.abs(value-62)<=2,'expected 62%, got '+value);
 });
 await check('Previous and next page controls change position',async()=>{
   let a=await page.locator('#readerScroll').evaluate(el=>el.scrollTop);
   await page.locator('#nextPage').click();let b=await page.locator('#readerScroll').evaluate(el=>el.scrollTop);assert.ok(b>a);
   await page.locator('#previousPage').click();let c=await page.locator('#readerScroll').evaluate(el=>el.scrollTop);assert.ok(c<b);
 });
 await check('Spacing and width settings work and persist across reopen',async()=>{
   await page.locator('#toggleSettings').click();
   await page.locator('[data-spacing=airy]').click();await page.locator('[data-width=narrow]').click();
   assert.equal(await page.locator('#reader').getAttribute('data-spacing'),'airy');assert.equal(await page.locator('#reader').getAttribute('data-width'),'narrow');
   await page.locator('#toggleSettings').click();await page.locator('#closeReader').click();
   await page.locator('#booksGrid [data-open]').first().click();await page.locator('.reader-text').waitFor();
   assert.equal(await page.locator('#reader').getAttribute('data-spacing'),'airy');assert.equal(await page.locator('#reader').getAttribute('data-width'),'narrow');
 });
 await check('External source links match selected book',async()=>{
   const id=await page.locator('#booksGrid [data-open]').first().getAttribute('data-open');
   assert.equal(await page.locator('#readerSourceTop').getAttribute('href'),'https://www.gutenberg.org/ebooks/'+id);
   assert.equal(await page.locator('#sourceLink').getAttribute('href'),'https://www.gutenberg.org/ebooks/'+id);
 });
 await check('Escape closes settings before closing reader',async()=>{
   await page.locator('#toggleSettings').click();await page.keyboard.press('Escape');
   assert.equal(await page.locator('#readerSettings').isVisible(),false);assert.equal(await page.locator('#reader').isVisible(),true);
   await page.keyboard.press('Escape');assert.equal(await page.locator('#reader').isVisible(),false);
 });
 await check('Home CTA and continue button are reachable',async()=>{await page.locator('#brandLink').click();assert.equal(await page.locator('#continueBanner').isVisible(),true);await page.locator('#continueButton').click();await page.locator('.reader-text').waitFor();await page.locator('#closeReader').click()});
 await check('Unavailable book shows Gutenberg fallback without crash',async()=>{
   await page.unrouteAll({behavior:'wait'});
   await page.route('**/api/read?id=*',route=>route.fulfill({status:415,contentType:'text/plain',body:'No text edition'}));
   await page.route('**/api/edition?id=*',route=>route.fulfill({status:415,contentType:'text/plain',body:'No HTML edition'}));
   await page.locator('#booksGrid [data-open]').first().click();
   await page.locator('.reading-error').waitFor({timeout:12000});
   const href=await page.locator('.reading-error a').getAttribute('href');assert.match(href,/gutenberg.org\/ebooks\/\d+/);
   assert.equal(await page.locator('#readerSeek').isDisabled(),true);
   await page.locator('#closeReader').click();
 });
 await check('Responsive layout has no overflow at 320/375/390/768/1024px',async()=>{
  for(const width of [320,375,390,768,1024]){
   await page.setViewportSize({width,height:800});await page.locator(width<=690?'.mobile-link[data-page=home]':'#brandLink').click();
   const x=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(x.content<=x.viewport+3,JSON.stringify({width,...x}));
  }
 });
 await check('No JavaScript exceptions throughout edge flows',async()=>assert.deepEqual(errors,[]));
 console.log('EDGE SUMMARY',pass,'passed',fail,'failed');if(fail)process.exitCode=1;
}finally{await browser.close();}
})();
