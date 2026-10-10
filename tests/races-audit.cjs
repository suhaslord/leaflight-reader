'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let pass=0,fail=0;
const check=async(name,fn)=>{try{await fn();console.log('PASS',name);pass++}catch(e){console.log('FAIL',name,String(e.message).slice(0,600));fail++}};
try{
const page=await browser.newPage({viewport:{width:1260,height:850}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(BASE);await page.locator('#booksGrid .book-card').first().waitFor();
const longText='REAL BOOK VERSION\n\n'+('Some ordinary words make up the contents of a book. '.repeat(30)+'\n\n').repeat(500);
await check('Rapid close/reopen cancels stale responses',async()=>{
 let n=0;
 await page.route('**/api/read?id=*',async route=>{
  n++;const i=n;
  if(i===1)await wait(650);else await wait(35);
  try{await route.fulfill({status:200,contentType:'text/plain',body:i===1?'STALE OLD RESPONSE\n\n'+longText:'FRESH NEW RESPONSE\n\n'+longText});}catch{}
 });
 const button=page.locator('#booksGrid [data-open]').first();
 await button.click();await wait(75);await page.locator('#closeReader').click();
 await button.click();await page.locator('.reader-text').waitFor({timeout:10000});
 await wait(780);
 const text=await page.locator('.reader-text').innerText();
 assert.ok(text.startsWith('FRESH NEW RESPONSE'),'stale response overwritten newer reader content');
 await page.locator('#closeReader').click();await page.unroute('**/api/read?id=*');
});
await check('Switching to another book displays only new book',async()=>{
 await page.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:longText}));
 const a=page.locator('#booksGrid [data-open]').nth(0),b=page.locator('#booksGrid [data-open]').nth(1);
 const titleB=await b.getAttribute('aria-label');
 await a.click();await page.locator('.reader-text').waitFor();await page.locator('#closeReader').click();
 await b.click();await page.locator('.reader-text').waitFor();
 assert.ok(titleB.includes(await page.locator('#readerTitle').innerText()));await page.locator('#closeReader').click();
 await page.unroute('**/api/read?id=*');
});
console.log('AFTER_READER_FLOW',await page.evaluate(()=>({readerHidden:document.querySelector('#reader').hidden,shellInert:document.querySelector('.shell').inert,active:document.activeElement?.id,bodyOverflow:document.body.style.overflow})));
await check('Rapid searches display latest query only',async()=>{
 let first=true;
 await page.route('**/api/books?*',async route=>{
  if(first&&route.request().url().includes('frankenstein')){first=false;await wait(500);}
  try{await route.continue();}catch{}
 });
 await page.locator('#searchInput').fill('frankenstein');await page.locator('#searchInput').press('Enter');
 await wait(45);await page.locator('#searchInput').fill('dracula');await page.locator('#searchInput').press('Enter');
 await page.locator('#booksGrid .book-card').first().waitFor();
 await wait(600);
 assert.match(await page.locator('#booksGrid .book-card').first().innerText(),/Dracula/i);
 await page.unroute('**/api/books?*');
});
await check('Temporary search server error shows retry and recovers',async()=>{
 let hits=0;
 await page.route('**/api/books?*',async route=>{if(++hits===1)await route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline"}'});else await route.continue()});
 await page.locator('#searchInput').fill('sherlock');await page.locator('#searchInput').press('Enter');
 await page.locator('[data-retry]').waitFor({timeout:10000});
 await page.locator('[data-retry]').click();await page.locator('#booksGrid .book-card').first().waitFor({timeout:12000});
 assert.match(await page.locator('#booksGrid .book-card').first().innerText(),/Sherlock/i);
 await page.unroute('**/api/books?*');
});
await check('AI server failure restores submit button and retry',async()=>{
 await page.route('**/api/recommend',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"offline"}'}));
 await page.locator('#aiPrompt').fill('a touching story about an ocean journey');await page.locator('#aiSubmit').click();
 await page.getByText('Could not find your book yet').waitFor({timeout:10000});
 assert.equal(await page.locator('#aiSubmit').isEnabled(),true);
 await page.unroute('**/api/recommend');await page.locator('#aiSubmit').click();
 await page.locator('#aiResults .ai-pick').first().waitFor({timeout:12000});
 assert.equal(await page.locator('#aiResults .ai-pick').count(),5);
});
await check('No uncaught exceptions under concurrency',async()=>assert.deepEqual(errors,[]));
console.log('RACE SUMMARY',pass,'passed',fail,'failed');if(fail)process.exitCode=1;
}finally{await browser.close();}
})();
