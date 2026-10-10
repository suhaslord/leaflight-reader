'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'https://leaflight-reader.vercel.app';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let passed=0;
 async function check(name,fn){try{await fn();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e.stack||e);process.exitCode=1;}}
 try{
  const page=await browser.newPage({viewport:{width:1440,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#booksGrid .book-card').first().waitFor({timeout:25000});
  await page.screenshot({path:'/tmp/leaflight-desktop.png',fullPage:true});
  await check('Recommendation box is visible and accessible',async()=>{assert.equal(await page.locator('#aiConcierge').isVisible(),true);assert.equal(await page.locator('#aiPrompt').getAttribute('maxlength'),'320');});
  await check('Quick prompt returns actual books and matching disclosure',async()=>{await page.locator('[data-ai-prompt]').first().click();await page.locator('#aiResults .ai-pick').first().waitFor({timeout:25000});assert.equal(await page.locator('#aiResults .ai-pick').count(),5);assert.equal(await page.locator('#aiResponseTag').innerText(),'Smart book matching');});
  await page.screenshot({path:'/tmp/leaflight-desktop-with-picks.png',fullPage:true});
  await check('Recommendation book opens a complete reader',async()=>{await page.locator('#aiResults [data-open]').first().click();await page.locator('#reader .reader-text').waitFor({timeout:30000});assert.ok((await page.locator('.reader-text').innerText()).length>2000);await page.locator('#closeReader').click();});
  await check('Recommendation is savable to library',async()=>{await page.locator('#aiResults [data-save]').first().click();assert.equal(await page.locator('#savedCount').innerText(),'1');});
  await check('No JavaScript errors after recommendations',async()=>assert.deepEqual(errors,[]));
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
  await mobile.goto(BASE,{waitUntil:'domcontentloaded'});
  await mobile.locator('#booksGrid .book-card').first().waitFor({timeout:25000});
  await mobile.screenshot({path:'/tmp/leaflight-mobile.png',fullPage:true});
  await check('Mobile guide recommends and fits viewport',async()=>{await mobile.locator('[data-ai-prompt]').nth(1).click();await mobile.locator('#aiResults .ai-pick').first().waitFor({timeout:25000});const width=await mobile.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth}));assert.ok(width.scrollWidth<=width.innerWidth+3,JSON.stringify(width));});
  await mobile.screenshot({path:'/tmp/leaflight-mobile-with-picks.png',fullPage:true});
  await check('Mobile AI results open reader',async()=>{await mobile.locator('#aiResults [data-open]').first().click();await mobile.locator('#reader .reader-text').waitFor({timeout:30000});await mobile.locator('#closeReader').click();assert.deepEqual(mobileErrors,[]);});
 }finally{await browser.close();}
 console.log('AI BROWSER SUMMARY',passed,'passed / 7 checks');
})();
