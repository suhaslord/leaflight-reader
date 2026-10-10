'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'https://leaflight-reader.vercel.app';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let pass=0,fail=0;const check=async(name,fn)=>{try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.error('FAIL',name,String(e.message).slice(0,450))}};
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 if(BASE.includes('127.0.0.1'))await page.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:('A timeless chapter with readable paragraphs. '.repeat(25)+'\\n\\n').repeat(600)}));
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#booksGrid .book-card').first().waitFor();
 const cards=()=>page.locator('#booksGrid .book-card');
 await check('Catalog first page',async()=>assert.equal(await cards().count(),25));
 await check('Desktop nav: Home, Discover, Library',async()=>{for(const key of ['explore','library','home']){await page.locator('.side-nav [data-page='+key+']').click();assert.equal(await page.locator('.side-nav [data-page='+key+']').getAttribute('aria-current'),'page')}});
 await check('Empty library CTA',async()=>{await page.locator('.side-nav [data-page=library]').click();await page.locator('#gridStatus [data-reset]').click();await cards().first().waitFor();});
 await check('Brand home action',async()=>{await page.locator('#brandLink').click();assert.equal(await page.locator('#hero').isVisible(),true)});
 await check('Hero discover CTA',async()=>{await page.locator('#heroExplore').click();assert.equal(await page.locator('#hero').isVisible(),false)});
 await check('Explore all CTA',async()=>{await page.locator('#brandLink').click();await page.locator('#viewAll').click();assert.equal(await page.locator('#hero').isVisible(),false)});
 await check('Header library shortcut',async()=>{await page.locator('#libraryShortcut').click();assert.match(await page.locator('#sectionTitle').innerText(),/library/i)});
 await check('Search input and Enter',async()=>{await page.locator('#searchInput').fill('frankenstein');await page.locator('#searchInput').press('Enter');await cards().first().waitFor();assert.match(await cards().first().innerText(),/Frankenstein/)});
 await check('No-results reset',async()=>{await page.locator('#searchInput').fill('zzxxzeroresults2026');await page.locator('#searchInput').press('Enter');await page.locator('[data-reset]').waitFor();await page.locator('[data-reset]').click();await cards().first().waitFor();assert.equal(await page.locator('#searchInput').inputValue(),'')});
 await check('Every genre filter',async()=>{for(const category of ['Fiction','Adventure','Mystery','Science fiction','Romance','Poetry','History','']){await page.locator('.chip').filter({has:page.locator('never')}).count();const chip=page.locator('.chip').filter({hasText:/./}).count();await page.locator('.chip[data-topic="'+category+'"]').click();await cards().first().waitFor();assert.equal(await page.locator('.chip[data-topic="'+category+'"]').getAttribute('aria-pressed'),'true')}});
 await check('Load more action',async()=>{await page.locator('#loadMore').click();await page.waitForFunction(()=>document.querySelectorAll('#booksGrid .book-card').length===50,{timeout:22000});assert.equal(await cards().count(),50)});
 await check('Save and unsave card',async()=>{await cards().first().locator('[data-save]').click();assert.equal(await cards().first().locator('[data-save]').getAttribute('aria-pressed'),'true');await cards().first().locator('[data-save]').click();assert.equal(await cards().first().locator('[data-save]').getAttribute('aria-pressed'),'false')});
 await check('Reader open, save, style controls',async()=>{
 await cards().first().locator('[data-open]').click();await page.locator('.reader-text').waitFor({timeout:30000});await page.locator('#readerSave').click();assert.match(await page.locator('#readerSave').getAttribute('aria-label'),/Remove/);await page.locator('#readerSave').click();
 await page.locator('#toggleSettings').click();await page.locator('#fontLarger').click();await page.locator('#fontSmaller').click();
 for(const font of ['sans','serif']){await page.locator('[data-font='+font+']').click();assert.equal(await page.locator('#reader').getAttribute('data-font'),font)}
 for(const theme of ['night','sepia','paper']){await page.locator('[data-theme='+theme+']').click();assert.equal(await page.locator('#reader').getAttribute('data-theme'),theme)}
 await page.locator('#toggleSettings').click();
 });
 await check('Bookmark, jump, Escape close',async()=>{await page.locator('#readerScroll').evaluate(el=>el.scrollTop=el.scrollHeight*.3);await page.waitForTimeout(140);await page.locator('#bookmarkPosition').click();assert.equal(await page.locator('#jumpBookmark').isVisible(),true);await page.locator('#readerScroll').evaluate(el=>el.scrollTop=el.scrollHeight*.6);await page.locator('#jumpBookmark').click();await page.waitForTimeout(140);assert.ok(parseInt(await page.locator('#readerProgress').innerText())<40);await page.keyboard.press('Escape');assert.equal(await page.locator('#reader').isVisible(),false)});
 await check('Continue reading banner',async()=>{await page.locator('#brandLink').click();await page.locator('#continueButton').click();await page.locator('.reader-text').waitFor({timeout:30000});await page.locator('#closeReader').click()});
 await check('AI quick prompts all 3 actions',async()=>{for(let i=0;i<3;i++){await page.locator('[data-ai-prompt]').nth(i).click();await page.locator('#aiResults .ai-pick').first().waitFor({timeout:25000});assert.equal(await page.locator('#aiResults .ai-pick').count(),5)}});
 await check('AI form and card read/save',async()=>{await page.locator('#aiPrompt').fill('a funny mystery with clever people');await page.locator('#aiSubmit').click();await page.locator('#aiResults .ai-pick').first().waitFor();await page.locator('#aiResults .ai-pick').first().locator('[data-save]').click();await page.locator('#aiResults .ai-pick').first().locator('[data-open]').click();await page.locator('.reader-text').waitFor({timeout:30000});await page.locator('#closeReader').click()});
 await check('Desktop no overflow / runtime exceptions',async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3));assert.deepEqual(errors,[])});
 await check('Mobile nav, search, reader, saved and themes',async()=>{
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const m=await mobile.newPage(),es=[];
 if(BASE.includes('127.0.0.1'))await m.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:('Once upon a time, a long readable story. '.repeat(25)+'\\n\\n').repeat(500)}));m.on('pageerror',e=>es.push(e.message));await m.goto(BASE,{waitUntil:'domcontentloaded'});await m.locator('#booksGrid .book-card').first().waitFor();
 for(const key of ['explore','library','home']){await m.locator('.mobile-link[data-page='+key+']').click();assert.equal(await m.locator('.mobile-link[data-page='+key+']').getAttribute('aria-current'),'page')}
 await m.locator('#searchInput').fill('dracula');await m.locator('#searchInput').press('Enter');
 await m.waitForFunction(()=>document.querySelector('#booksGrid .book-card')?.innerText.toLowerCase().includes('dracula'),null,{timeout:15000});
 await m.locator('#booksGrid [data-open]').first().click();await m.locator('.reader-text').waitFor({timeout:30000});await m.locator('#toggleSettings').click();await m.locator('[data-theme=night]').click();await m.locator('#closeReader').click();assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3));assert.deepEqual(es,[]);await mobile.close()
 });
 console.log('SUMMARY',pass,'passed',fail,'failed');if(fail)process.exitCode=1;
 }finally{await browser.close()}
})();
