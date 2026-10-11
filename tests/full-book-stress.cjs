'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const p=await b.newPage({viewport:{width:1290,height:820},reducedMotion:'reduce'});
 await p.goto(process.env.BASE_URL||'http://127.0.0.1:4195',{waitUntil:'domcontentloaded'});
 await p.locator('#searchInput').fill('War and Peace');
 await p.locator('#searchInput').press('Enter');
 await p.waitForFunction(()=>!!document.querySelector('#booksGrid [data-open="2600"]'),null,{timeout:18000});
 const before=Date.now();await p.locator('#booksGrid [data-open="2600"]').click();
 await p.locator('.reader-formatted-edition').waitFor({timeout:42000});
 console.log('HTML_LOAD_MS',Date.now()-before);
 await p.locator('#readerSeek').fill('37');
 await p.locator('#toggleSettings').click();
 for(let i=0;i<8;i++){const t=Date.now();await p.locator('#fontLarger').click({timeout:8500,noWaitAfter:true});console.log('FONT_CLICK',i,Date.now()-t);}
 await p.locator('[data-theme=night]').click();
 await p.locator('#toggleSettings').click();
 await p.waitForTimeout(650);
 const pos=parseInt(await p.locator('#readerProgress').innerText());
 console.log('POSITION',pos);
 assert.ok(pos>20&&pos<56,'Reading position should be roughly preserved after typography changes');
 await p.locator('#closeReader').click();
 console.log('LONG HTML BOOK PASS');
}finally{await b.close();}
})().catch(e=>{console.error('LONG HTML BOOK FAIL',e.stack?.slice(0,1700));process.exitCode=1});
