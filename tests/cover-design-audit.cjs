'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4195';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:870},deviceScaleFactor:1,reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   await page.locator('#booksGrid .book-card').first().waitFor({timeout:15000});
   await page.waitForTimeout(1800);
   const report=await page.evaluate(()=>{
    const imgs=[...document.querySelectorAll('#booksGrid .book-cover img')];
    return {cards:document.querySelectorAll('#booksGrid .book-card').length,
      imgs:imgs.length,good:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,
      covers:imgs.slice(0,10).map(x=>({src:x.getAttribute('src'),loaded:x.naturalWidth>0})),
      hero:document.querySelector('.hero-art img')?.naturalWidth||0,
      overflow:document.documentElement.scrollWidth-innerWidth};
   });
   console.log('WIDTH',width,JSON.stringify(report));
   assert.equal(report.cards,25);
   assert.equal(report.imgs,25,'All cards should have cover images');
   assert.ok(report.good>=8,'Visible first books should load covers');
   assert.ok(report.hero>0,'Real featured cover should load');
   assert.ok(report.overflow<=3,'No horizontal scrolling');
   assert.deepEqual(errors,[]);
   await page.screenshot({path:'/tmp/leaflight-new-design-'+width+'.png',fullPage:false});
   await page.locator('#searchInput').fill('Kalevala');
   await page.locator('#searchInput').press('Enter');
   await page.waitForFunction(()=>document.querySelector('#booksGrid .book-card')?.innerText.includes('Kalevala'),null,{timeout:12000});
   await page.locator('#languageFilter').selectOption('fi');
   await page.waitForFunction(()=>document.querySelector('#booksGrid .book-card')?.innerText.includes('Kalevala'),null,{timeout:12000});
   const finnish=await page.locator('#booksGrid .book-card').first().innerText();
   console.log('FINNISH',width,finnish.slice(0,100));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error('COVER DESIGN FAILED',e.stack?.slice(0,1800));process.exitCode=1});
