'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4195';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(()=>{
  const html='<html><body><header class="pg-header">License block</header><div class="chapter"><h2>CHAPTER I</h2>'+
   '<p>'+('Safe original chapter text. '.repeat(18))+'</p><p>'+('More book contents. '.repeat(18))+'</p>'+
   '<script>window.editionXss=true</script><iframe src="https://example.com"></iframe>'+
   '<img src="https://evil.test/unsafe.png" onerror="window.editionXss=true">'+
   '<img src="images/illustration.jpg" onerror="window.editionXss=true"></div></body></html>';
  const rendered=window.LeaflightEdition.render(html,74);
  if(!rendered)return null;
  return {bad:window.editionXss===true,scripts:rendered.querySelectorAll('script').length,
   iframes:rendered.querySelectorAll('iframe').length,
   images:[...rendered.querySelectorAll('img')].map(x=>({url:x.src,events:x.hasAttribute('onerror')})),
   license:rendered.innerText?.includes('License block')||false};
 });
 console.log('SECURITY',result);
 assert.ok(result);
 assert.equal(result.bad,false);
 assert.equal(result.scripts,0);assert.equal(result.iframes,0);
 assert.equal(result.images.length,1);
 assert.equal(result.images[0].url,'https://www.gutenberg.org/cache/epub/74/images/illustration.jpg');
 assert.equal(result.images[0].events,false);
 assert.equal(result.license,false);
 console.log('SAFE EDITION PARSER PASS');
}finally{await browser.close()}
})().catch(e=>{console.error(e.stack?.slice(0,1500));process.exitCode=1});
