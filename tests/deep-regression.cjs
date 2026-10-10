'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
(async()=>{
  let pass=0,fail=0;
  const check=async(name,fn)=>{try{await fn();console.log('PASS',name);pass++;}catch(e){console.log('FAIL',name,String(e.message).slice(0,400));fail++;}};
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:1200,height:850},reducedMotion:'reduce'});
    const p=await context.newPage();
    const fixture='LEAFLIGHT TEST NOVEL\n\n'+('This is a chapter of our example novel, full of meaningful characters and clear text. '.repeat(16)+'\n\n').repeat(400);
    await p.route('**/api/read?id=*', route=>route.fulfill({status:200,contentType:'text/plain',body:fixture}));
    await p.goto(BASE,{waitUntil:'domcontentloaded'});
    await p.locator('#booksGrid .book-card').first().waitFor();
    await check('Reader button UI inventory functional',async()=>{
      await p.locator('#booksGrid [data-open]').first().click();
      await p.locator('.reader-text').waitFor();
      for(const selector of ['#closeReader','#readerSourceTop','#readerSave','#toggleSettings','#readerSeek','#previousPage','#nextPage','#bookmarkPosition','#sourceLink']){
        assert.equal(await p.locator(selector).count(),1,selector+' missing');
      }
      await p.locator('#readerSeek').fill('67');
      const progress=parseInt(await p.locator('#readerProgress').innerText());
      assert.ok(Math.abs(progress-67)<3,'seek should be ~67%, got '+progress);
      const before=await p.locator('#readerScroll').evaluate(el=>el.scrollTop);
      await p.locator('#previousPage').click();
      const prev=await p.locator('#readerScroll').evaluate(el=>el.scrollTop);
      assert.ok(prev<before,'Previous page should scroll upward');
      await p.locator('#nextPage').click();
      const next=await p.locator('#readerScroll').evaluate(el=>el.scrollTop);
      assert.ok(next>prev,'Next page should scroll downward');
    });
    await check('Reader font sizes enforce bounds',async()=>{
      await p.locator('#toggleSettings').click();
      await p.evaluate(()=>{state.settings.size=15;readSettings();});
      await p.locator('#fontSmaller').click();
      assert.equal(await p.locator('#fontSize').innerText(),'15px');
      await p.evaluate(()=>{state.settings.size=28;readSettings();});
      await p.locator('#fontLarger').click();
      assert.equal(await p.locator('#fontSize').innerText(),'28px');
      await p.evaluate(()=>{state.settings.size=19;readSettings();});
      await p.waitForTimeout(400);
    });
    await check('Margins and line spacing selectors',async()=>{
      for(const kind of ['width','spacing']){
        const opts=await p.locator('.reader-settings button[data-'+kind+']').evaluateAll((els,kind)=>els.map(el=>el.dataset[kind]),kind);
        for(const option of opts){
          await p.locator('.reader-settings button[data-'+kind+'="'+option+'"]').click();
          assert.equal(await p.locator('#reader').getAttribute('data-'+kind),option);
          assert.equal(await p.locator('.reader-settings button[data-'+kind+'="'+option+'"]').getAttribute('aria-pressed'),'true');
        }
      }
      await p.locator('#toggleSettings').click();
    });
    await check('Progress remains accurate after change to narrow/large',async()=>{
      await p.locator('#readerSeek').fill('48');
      await p.locator('#toggleSettings').click();
      await p.locator('.reader-settings button[data-width=narrow]').click();
      await p.locator('.reader-settings button[data-spacing=airy]').click();
      await p.waitForTimeout(120);
      assert.ok(Math.abs(parseInt(await p.locator('#readerProgress').innerText())-48)<=5);
      await p.locator('#toggleSettings').click();
    });
    await check('Reload retains settings and reading position',async()=>{
      const before=parseInt(await p.locator('#readerProgress').innerText());
      await p.locator('#closeReader').click();
      await p.reload();
      await p.locator('#booksGrid .book-card').first().waitFor();
      await p.locator('#booksGrid [data-open]').first().click();
      await p.locator('.reader-text').waitFor();
      await p.waitForTimeout(160);
      assert.equal(await p.locator('#reader').getAttribute('data-width'),'narrow');
      assert.equal(await p.locator('#reader').getAttribute('data-spacing'),'airy');
      assert.equal(await p.locator('#fontSize').innerText(),'19px');
      await p.evaluate(()=>{state.settings.size=19;readSettings();});
      await p.waitForTimeout(400);
      assert.ok(Math.abs(parseInt(await p.locator('#readerProgress').innerText())-before)<=3);
    });
    await check('Original book links are correct and safe',async()=>{
      for(const selector of ['#sourceLink','#readerSourceTop']){
        const href=await p.locator(selector).getAttribute('href'),target=await p.locator(selector).getAttribute('target'),rel=await p.locator(selector).getAttribute('rel');
        assert.match(href,/^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/);assert.equal(target,'_blank');assert.match(rel,/noopener/);
      }
    });
    await check('Reader ignores obsolete request after close',async()=>{
      await p.locator('#closeReader').click();
      await p.route('**/api/read?id=*',async route=>{await new Promise(r=>setTimeout(r,700));await route.continue()});
      await p.locator('#booksGrid [data-open]').first().click();
      await p.locator('#closeReader').click();
      await p.waitForTimeout(800);
      assert.equal(await p.locator('#reader').isVisible(),false);
      assert.equal(await p.evaluate(()=>document.body.style.overflow),'');
      assert.equal(await p.evaluate(()=>document.querySelector('.shell').inert),false);
      await p.unroute('**/api/read?id=*');
    });
    await check('Search API error shows retry UI',async()=>{
      await p.route('**/api/books?*',route=>route.fulfill({status:503,body:'unavailable'}));
      await p.locator('#searchInput').fill('impossiblebook');
      await p.locator('#searchInput').press('Enter');
      await p.locator('#gridStatus [data-retry]').waitFor();
      await p.unroute('**/api/books?*');
      await p.locator('#gridStatus [data-retry]').click();
      await p.locator('#gridStatus [data-reset]').waitFor();
      await p.locator('#gridStatus [data-reset]').click();
      await p.locator('#booksGrid .book-card').first().waitFor();
    });
    await check('Reader upstream failure gives original fallback',async()=>{
      await p.route('**/api/read?id=*',route=>route.fulfill({status:503,body:'temporarily unavailable'}));
      await p.locator('#booksGrid [data-open]').first().click();
      await p.locator('.reading-error a').waitFor();
      assert.match(await p.locator('.reading-error a').getAttribute('href'),/^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/);
      await p.locator('#closeReader').click();
      await p.unroute('**/api/read?id=*');
    });
    await check('AI upstream failure resets loading/button',async()=>{
      await p.route('**/api/recommend',route=>route.fulfill({status:503,body:'not ready'}));
      await p.locator('[data-ai-prompt]').first().click();
      await p.locator('#aiResponseTitle').getByText('Could not find your book yet').waitFor();
      assert.equal(await p.locator('#aiSubmit').isEnabled(),true);
      await p.unroute('**/api/recommend');
      await p.locator('[data-ai-prompt]').nth(1).click();
      await p.locator('#aiResults .ai-pick').first().waitFor();
    });
    await check('Reader localStorage failure does not crash page',async()=>{
      await p.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('Storage blocked')}}));
      await p.reload();
      await p.locator('#booksGrid .book-card').first().waitFor();
      await p.locator('#booksGrid [data-open]').first().click();
      await p.locator('.reader-text').waitFor();
      await p.locator('#closeReader').click();
    });
    await context.close();
    for(const width of [320,390,768]){
      await check('Responsive catalog and reader '+width+'px',async()=>{
        const c=await browser.newContext({viewport:{width,height:840},isMobile:width<=430,hasTouch:width<=430,reducedMotion:'reduce'});
        const page=await c.newPage();await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#booksGrid .book-card').first().waitFor();
        const readOverflow=async()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
        assert.ok((await readOverflow())<=3,'catalog overflow '+await readOverflow());
        await page.locator('#booksGrid [data-open]').first().click({timeout:12000});
        await page.locator('.reader-text').waitFor();
        const layout=await page.evaluate(()=>{const r=document.querySelector('.reader'),footer=document.querySelector('.reader-bottom'),slide=document.querySelector('#readerSeek');return {scroll:r.scrollWidth,view:innerWidth,footer:footer.getBoundingClientRect().height,seek:slide.getBoundingClientRect().width}});
        assert.ok(layout.scroll<=layout.view+3,'reader overflow '+JSON.stringify(layout));
        assert.ok(layout.seek>30,'seek should be usable: '+JSON.stringify(layout));
        await page.locator('#toggleSettings').click();
        assert.equal(await page.locator('#readerSettings').isVisible(),true);
        await page.locator('#closeReader').click();
        await c.close();
      });
    }
    console.log('DEEP AUDIT:',pass,'passed,',fail,'failed');if(fail)process.exitCode=1;
  }finally{await browser.close()}
})();
