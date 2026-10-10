'use strict';
const {chromium}=require('playwright'),Axe=require('@axe-core/playwright').default,assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let total=0;
 try{
 for(const [name,width] of [['desktop',1440],['phone',390]]){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce',isMobile:width<500,hasTouch:width<500});
  const page=await context.newPage();
  await page.route('**/api/read?id=*',r=>r.fulfill({status:200,contentType:'text/plain',body:('Some sample Gutenberg text to check accessibility. '.repeat(30)+'\n\n').repeat(90)}));
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:4185');
  await page.locator('#booksGrid .book-card').first().waitFor();
  const check=async(stage)=>{
    const r=await new Axe({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    console.log(name,stage,'violations',JSON.stringify(r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,contrast:n.any?.find(a=>a.id==='color-contrast')?.data}))}))));
    assert.equal(r.violations.length,0,name+' '+stage+' should have no WCAG A/AA violations');
    total++;
  };
  await check('catalog');
  await page.locator('#booksGrid [data-open]').first().click();await page.locator('.reader-text').waitFor();
  await check('paper reader');
  await page.locator('#toggleSettings').click();await check('open settings');
  await page.locator('[data-theme=sepia]').click();await check('sepia');
  await page.locator('[data-theme=night]').click();await check('night');
  await page.locator('#closeReader').click();
  await context.close();
 }
 console.log('ACCESSIBILITY SUMMARY',total,'passes');
 }finally{await browser.close();}
})().catch(e=>{console.error('ACCESSIBILITY FAILED',e.stack?.slice(0,1700));process.exitCode=1});
