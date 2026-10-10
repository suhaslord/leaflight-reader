'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4185';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1360,390]){
  const page=await browser.newPage({viewport:{width,height:840},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
  const sample=('A lengthy paragraph of public-domain-style test text, with dialogue and narrative. '.repeat(21)+'\r\n\r\n');
  const text=sample.repeat(Math.ceil(3_350_000/sample.length)).slice(0,3_350_000);
  page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  await page.route('**/api/read?id=*',r=>r.fulfill({status:200,contentType:'text/plain',body:text}));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#searchInput').fill('war and peace');await page.locator('#searchInput').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#booksGrid .book-card')?.innerText.toLowerCase().includes('war and peace'),null,{timeout:15000});
  await page.locator('#booksGrid [data-open]').first().click();
  await page.locator('.reader-text').waitFor({timeout:20000});
  const textInfo=await page.locator('.reader-text').evaluate(el=>({total:el.textContent.length,sections:el.children.length}));
  assert.equal(textInfo.total,text.replace(/\r\n?/g,'\n').length);
  console.log('OPEN',width,JSON.stringify(textInfo));
  await page.locator('#toggleSettings').click({noWaitAfter:true});
  for(let i=0;i<12;i++){
   const t=Date.now();
   await page.locator('#fontLarger').click({timeout:9000,noWaitAfter:true});
   const took=Date.now()-t;assert.ok(took<3500,'Typography stalled for '+took+'ms');console.log('FONT',width,i,'ms',took);
  }
  await page.locator('[data-theme=night]').click({timeout:9000,noWaitAfter:true});
  await page.locator('[data-spacing=airy]').click({timeout:9000,noWaitAfter:true});
  await page.locator('#toggleSettings').click({noWaitAfter:true});
  await page.locator('#readerSeek').fill('65',{timeout:9000});
  await page.waitForTimeout(350);
  console.log('SEEK',width,await page.locator('#readerProgress').innerText());
  await page.locator('#nextPage').click({timeout:9000,noWaitAfter:true});
  await page.locator('#bookmarkPosition').click({timeout:9000,noWaitAfter:true});
  await page.locator('#closeReader').click({timeout:9000,noWaitAfter:true});
  console.log('CLOSED',width,await page.locator('#reader').isHidden());
  await page.close();
 }
}finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.stack?.slice(0,1700));process.exitCode=1});
