'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4195';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [id,title] of [[74,'Tom Sawyer'],[1342,'Pride and Prejudice'],[11,'Alice'],[84,'Frankenstein']]){
  const context=await browser.newContext({viewport:{width:390,height:850},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#searchInput').fill(title);await page.locator('#searchInput').press('Enter');
  await page.waitForFunction(id=>!!document.querySelector('#booksGrid [data-open="'+id+'"]'),id,{timeout:15000});
  await page.locator('#booksGrid [data-open="'+id+'"]').first().click();
  await page.locator('.reader-formatted-edition').waitFor({timeout:35000});
  const report=await page.locator('.reader-formatted-edition').evaluate(el=>({
    textLength:el.textContent.length,images:el.querySelectorAll('img.edition-art').length,
    headings:el.querySelectorAll('h2,h3').length,paragraphs:el.querySelectorAll('p').length,
    overflow:document.documentElement.scrollWidth-innerWidth,
    imageHost:el.querySelector('img.edition-art')?.src||''
  }));
  console.log('BOOK',id,JSON.stringify(report));
  assert.ok(report.textLength>10000);
  assert.ok(report.headings>1);
  assert.ok(report.overflow<=3);
  if(id===74)assert.ok(report.images>100,'Tom Sawyer should show authentic illustrations');
  if(id===1342)assert.ok(report.images>50,'Austen should show authentic illustrations');
  await page.locator('#toggleSettings').click();
  await page.locator('[data-edition=text]').click();
  assert.equal(await page.locator('.reader-formatted-edition').count(),0);
  await page.locator('[data-edition=illustrated]').click();
  assert.equal(await page.locator('.reader-formatted-edition').count(),1);
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('GENERIC BOOK IMAGES PASS');
}finally{await browser.close()}
})().catch(e=>{console.error('BOOK IMAGES FAILED',e.stack?.slice(0,1900));process.exitCode=1});
