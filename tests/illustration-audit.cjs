'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4185';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [390,1320]){
  const page=await browser.newPage({viewport:{width,height:850},reducedMotion:'reduce',deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#booksGrid .book-card').first().waitFor();
  await page.locator('#booksGrid [data-open]').first().click();
  await page.locator('.reader-text').waitFor({timeout:35000});
  const x=await page.locator('.reader-text').evaluate(el=>({
   figures:el.querySelectorAll('figure.reader-illustration').length,
   realImages:el.querySelectorAll('figure.reader-illustration img').length,
   source:el.querySelectorAll('.reader-illustration-source').length,
   copyrightBits:[...el.querySelectorAll('.reader-prose,.reader-verse')].filter(n=>n.innerText.includes('Copyright 1894')).length,
   firstCredit:el.querySelector('figure.reader-illustration .reader-illustration-credit')?.textContent,
   sampleCaptions:[...el.querySelectorAll('figure.reader-illustration figcaption')].slice(0,7).map(n=>n.textContent),
   overflow:document.documentElement.scrollWidth-innerWidth
  }));
  console.log('SCREEN',width,JSON.stringify(x));
  assert.ok(x.source>70 && x.realImages>=40);
  assert.equal(x.overflow,0);
  // A figure with an actual scene (not a decorative chapter initial) should load.
  const image=page.locator('figure.reader-illustration img').first();
  await image.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2100);
  const imageInfo=await image.evaluate(img=>({complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc.slice(-90)}));
  console.log('FIRST IMAGE',imageInfo);
  if(process.env.SCREENSHOTS)await page.screenshot({path:'/tmp/leaflight-illustrated-'+width+'.png'});
  assert.ok(imageInfo.naturalWidth>100,'Expected actual 1894 illustration, not a broken image');
  assert.deepEqual(errors,[]);
  await page.close();
 }
}finally{await browser.close()}
})().catch(e=>{console.error('ILLUSTRATION AUDIT FAILED',e.stack);process.exitCode=1});
