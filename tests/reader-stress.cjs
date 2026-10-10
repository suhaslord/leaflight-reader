'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'https://leaflight-reader.vercel.app';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let pass=0,fail=0;const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.log('FAIL',name,String(e.message).slice(0,380))}};
try{
const page=await browser.newPage({viewport:{width:1300,height:820},reducedMotion:'reduce'});
if(BASE.includes('127.0.0.1'))await page.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:'An unabridged test edition.\\n\\n'+('A long paragraph of readable story text to simulate a complete book. '.repeat(12)+'\\n\\n').repeat(800)}));
await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#booksGrid .book-card').first().waitFor();
await page.locator('#booksGrid [data-open]').first().click();await page.locator('.reader-text').waitFor({timeout:25000});
await check('Reading position preserved when changing font size',async()=>{
 await page.locator('#readerScroll').evaluate(el=>el.scrollTop=(el.scrollHeight-el.clientHeight)*.45);
 await page.waitForTimeout(180);
 const before=parseInt(await page.locator('#readerProgress').innerText());
 await page.locator('#toggleSettings').click();
 for(let i=0;i<6;i++)await page.locator('#fontLarger').click();
 await page.waitForTimeout(440);
 const after=parseInt(await page.locator('#readerProgress').innerText());
 const position=await page.locator('#readerScroll').evaluate(el=>Math.round(100*el.scrollTop/Math.max(1,el.scrollHeight-el.clientHeight)));
 assert.ok(Math.abs(after-before)<=4 && Math.abs(position-before)<=4,'reading position jumped '+before+'% => displayed '+after+'%, actual '+position+'%');
 await page.locator('#toggleSettings').click();
});
await check('Keyboard arrows page through reader',async()=>{
 await page.locator('#closeReader').focus();const before=await page.locator('#readerScroll').evaluate(el=>el.scrollTop);
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(220);
 const after=await page.locator('#readerScroll').evaluate(el=>el.scrollTop);
 assert.ok(after>before,'ArrowRight should advance');
});
await check('Reader dialog contains keyboard focus',async()=>{
 await page.locator('#closeReader').focus();await page.keyboard.press('Shift+Tab');
 const focus=await page.evaluate(()=>document.activeElement?.closest('#reader')!==null);
 assert.equal(focus,true,'focus escaped modal');
});
await check('Reader has progress seek and page actions',async()=>{
 assert.equal(await page.locator('#readerSeek').count(),1);
 assert.equal(await page.locator('#nextPage').count(),1);
 assert.equal(await page.locator('#previousPage').count(),1);
});
await page.locator('#closeReader').click();
await check('Closing reader restores focus to opened book',async()=>{
const id=await page.evaluate(()=>document.activeElement?.getAttribute('data-open'));assert.ok(id,'expected original book button to receive focus');
});
console.log('SUMMARY',pass,'passed',fail,'failed');if(fail)process.exitCode=1;
}finally{await browser.close()}
})();
