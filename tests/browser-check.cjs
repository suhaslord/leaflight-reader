'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'https://leaflight-reader.vercel.app';
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  let passes=0, errors=[];
  async function check(name,fn){
    try{await fn(); console.log('PASS',name); passes++;}
    catch(e){console.log('FAIL',name,String(e).slice(0,800));errors.push(name+': '+e.message);}
  }
  try{
    const context=await browser.newContext({viewport:{width:1366,height:900}});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    await check('Desktop loads catalog and books',async()=>{
      await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('#booksGrid .book-card').first().waitFor({timeout:30000});
      assert.equal(await page.locator('#booksGrid .book-card').count(),25);
    });
    await check('Save a book and find it in My Library',async()=>{
      await page.locator('#booksGrid .card-save').first().click();
      await page.getByRole('button',{name:/My library/i}).first().click();
      await page.locator('#booksGrid .book-card').first().waitFor();
      assert.equal(await page.locator('#booksGrid .book-card').count(),1);
    });
    await check('In-browser reader opens full text',async()=>{
      await page.locator('.book-cover-button').first().click();
      await page.locator('.reader-text').waitFor({timeout:30000});
      assert.ok((await page.locator('.reader-text').innerText()).length>5000);
      assert.equal(await page.locator('#reader').isVisible(),true);
    });
    await check('Reader themes and typography work',async()=>{
      await page.locator('#toggleSettings').click();
      await page.locator('[data-theme="night"]').click();
      assert.equal(await page.locator('#reader').getAttribute('data-theme'),'night');
      await page.locator('#fontLarger').click();
      assert.equal(await page.locator('#fontSize').innerText(),'20px');
      await page.locator('[data-font="sans"]').click();
      assert.equal(await page.locator('#reader').getAttribute('data-font'),'sans');
      await page.locator('#toggleSettings').click();
    });
    await check('Bookmark navigation works',async()=>{
      await page.locator('#readerScroll').evaluate(el=>el.scrollTop=el.scrollHeight*.2);
      await page.waitForTimeout(200);
      await page.locator('#bookmarkPosition').click();
      assert.equal(await page.locator('#jumpBookmark').isVisible(),true);
      await page.locator('#readerScroll').evaluate(el=>el.scrollTop=el.scrollHeight*.5);
      await page.waitForTimeout(200);
      await page.locator('#jumpBookmark').click();
      await page.waitForTimeout(200);
      assert.ok(parseInt(await page.locator('#readerProgress').innerText())<30);
    });
    await check('Reader persists reading position',async()=>{
      await page.locator('#readerScroll').evaluate(el=>el.scrollTop=el.scrollHeight*.22);
      await page.waitForTimeout(300);
      const previous=await page.locator('#readerProgress').innerText();
      assert.ok(parseInt(previous)>10,'progress >10 expected, got '+previous);
      await page.locator('#closeReader').click();
      await page.locator('#booksGrid .book-cover-button').first().click();
      await page.locator('.reader-text').waitFor({timeout:30000});
      await page.waitForTimeout(200);
      const restored=await page.locator('#readerProgress').innerText();
      assert.ok(parseInt(restored)>10,'restored progress expected, got '+restored);
      await page.locator('#closeReader').click();
    });
    await check('Search finds Frankenstein',async()=>{
      await page.locator('#searchInput').fill('frankenstein');
      await page.locator('#searchInput').press('Enter');
      await page.locator('#booksGrid .book-card').first().waitFor({timeout:30000});
      assert.match(await page.locator('#booksGrid .book-card').first().innerText(),/Frankenstein/i);
    });
    await check('Mystery genre filter works',async()=>{
      await page.locator('[data-topic="Mystery"]').click();
      await page.locator('#booksGrid .book-card').first().waitFor({timeout:30000});
      assert.ok(await page.locator('#booksGrid .book-card').count()>1);
    });
    await check('Load more appends results',async()=>{
      await page.locator('#loadMore').click();
      await page.waitForFunction(()=>document.querySelectorAll('#booksGrid .book-card').length>=50,null,{timeout:30000});
      assert.equal(await page.locator('#booksGrid .book-card').count(),50);
    });
    await check('No desktop horizontal overflow or JS exceptions',async()=>{
      const widths=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
      assert.ok(widths[0]<=widths[1]+2,'viewport overflow '+JSON.stringify(widths));
      assert.deepEqual(pageErrors,[]);
    });
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
    const mpage=await mobile.newPage();
    const mobileErrors=[];
    mpage.on('pageerror',e=>mobileErrors.push(e.message));
    await check('iPhone layout and bottom navigation',async()=>{
      await mpage.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
      await mpage.locator('#booksGrid .book-card').first().waitFor({timeout:30000});
      assert.equal(await mpage.locator('.mobile-nav').isVisible(),true);
      const widths=await mpage.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
      assert.ok(widths[0]<=widths[1]+2,'mobile viewport overflow '+JSON.stringify(widths));
      await mpage.locator('.mobile-link[data-page="library"]').click();
      await mpage.getByText('Your little library').waitFor();
    });
    await check('Mobile search and reader controls',async()=>{
      await mpage.locator('#searchInput').fill('alice wonderland');
      await mpage.locator('#searchInput').press('Enter');
      await mpage.locator('#booksGrid .book-card').first().waitFor({timeout:30000});
      await mpage.locator('.book-cover-button').first().click();
      await mpage.locator('.reader-text').waitFor({timeout:30000});
      assert.equal(await mpage.locator('#reader').isVisible(),true);
      await mpage.locator('#closeReader').click();
      assert.equal(await mpage.locator('#reader').isVisible(),false);
      assert.deepEqual(mobileErrors,[]);
    });
    await page.screenshot({path:'/home/user/leaflight-reader/desktop-qa.png',fullPage:true});
    await mpage.screenshot({path:'/home/user/leaflight-reader/mobile-qa.png',fullPage:true});
    console.log('SUMMARY',passes,'passed /',passes+errors.length,'total');
    if(errors.length){console.log('ERRORS',errors);process.exitCode=1;}
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
