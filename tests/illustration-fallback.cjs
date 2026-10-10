'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const SAMPLE=[
 'The Project Gutenberg eBook of A Test Book',
 '*** START OF THE PROJECT GUTENBERG EBOOK A TEST BOOK ***',
 'CHAPTER I',
 'Before the illustration there was a paragraph.',
 '',
 '[Illustration: Scene in a garden',
 '  [_Copyright 1894 by An Original Publisher._]]',
 '',
 'After the illustration the story continued.',
 '*** END OF THE PROJECT GUTENBERG EBOOK A TEST BOOK ***'
].join('\n');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:840}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/read?id=84',route=>route.fulfill({status:200,contentType:'text/plain',body:SAMPLE}));
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:4185');
  await page.locator('#searchInput').fill('frankenstein');await page.locator('#searchInput').press('Enter');
  await page.waitForFunction(()=>!!document.querySelector('#booksGrid [data-open="84"]'));
  await page.locator('#booksGrid [data-open="84"]').click();
  await page.locator('.reader-text').waitFor();
  const figure=page.locator('.reader-illustration').first();
  await figure.waitFor();
  assert.equal(await page.locator('.reader-illustration-source').count(),1);
  assert.match(await figure.innerText(),/Scene in a garden/);
  assert.match(await figure.innerText(),/An Original Publisher, 1894/);
  assert.equal(await figure.locator('img').count(),0);
  assert.equal(await figure.locator('a').getAttribute('href'),'https://www.gutenberg.org/ebooks/84');
  assert.ok(!(await page.locator('.reader-prose').allInnerTexts()).some(x=>x.includes('[_Copyright')||x.includes('[Illustration')));
  assert.deepEqual(errors,[]);
  console.log('PASS clean fallback on unmatched illustration and copyright');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
