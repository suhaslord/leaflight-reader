'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,375,390,430,768]){
  const page=await browser.newPage({viewport:{width,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
  await page.route('**/api/read?id=*',r=>r.fulfill({status:200,contentType:'text/plain',body:('Some content for the reading experience. '.repeat(30)+'\n\n').repeat(250)}));
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:4173'));await page.locator('#booksGrid .book-card').first().waitFor();
  await page.locator('#booksGrid [data-open]').first().click();await page.locator('.reader-text').waitFor();
  await page.locator('#readerScroll').evaluate(el=>el.scrollTop=el.scrollHeight*.25);
  await page.locator('#bookmarkPosition').click();
  const report=await page.evaluate(()=>{
   const targets=['#previousPage','#nextPage','#readerSeek','#bookmarkPosition','#jumpBookmark','#readerSave','#toggleSettings'];
   return {overflow:document.documentElement.scrollWidth-innerWidth,
    elements:targets.map(id=>{const el=document.querySelector(id),r=el.getBoundingClientRect();return {id,x:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),height:Math.round(r.height)}})};
  });
  console.log('WIDTH',width,JSON.stringify(report));
  assert.ok(report.overflow<=3);
  for(const el of report.elements){assert.ok(el.x>=-4&&el.right<=width+4,el.id+' clipped at '+width)}
  await page.locator('#toggleSettings').click();
  const settings=await page.locator('#readerSettings').boundingBox();
  assert.ok(settings.x>=0&&settings.x+settings.width<=width+4,'settings exceeds viewport');
  await page.close();
 }
}finally{await browser.close()}
})().catch(e=>{console.error('MOBILE CHECK FAILED',e.message);process.exitCode=1});
