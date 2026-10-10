'use strict';
const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:375,height:812}});
 await context.addInitScript(()=>{
  localStorage.setItem('leaflight.v1.saved',JSON.stringify({'3':{id:3,title:'Valid',authors:'text'}}));
  localStorage.setItem('leaflight.v1.history','"oops"');
  localStorage.setItem('leaflight.v1.settings','"invalid"');
 });
 const page=await context.newPage();
 page.on('pageerror',e=>console.log('Page error:',e.message));
 await page.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:'Reading sample '.repeat(1500)}));
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:4173'),{waitUntil:'domcontentloaded'});
 await page.locator('.mobile-link[data-page=library]').click();
 console.log('library books',await page.locator('#booksGrid .book-card').count());
 await page.locator('#booksGrid [data-open]').first().click();
 await page.locator('.reader-text').waitFor({timeout:10000});
 console.log('theme',await page.locator('#reader').getAttribute('data-theme'));
 console.log('settings buttons',await page.locator('#readerSettings [data-theme]').count());
 console.log('settings html count', (await page.locator('#readerSettings').innerHTML()).length);
 await page.locator('#toggleSettings').click();
 console.log('paper buttons',await page.locator('#readerSettings [data-theme=paper]').count());
}finally{await browser.close();}
})().catch(e=>{console.error('storage audit failed',e.message);process.exitCode=1});
