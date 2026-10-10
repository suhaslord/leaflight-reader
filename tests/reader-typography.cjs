'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4185';
const FIXTURE=[
'*** START OF THE PROJECT GUTENBERG EBOOK A NOVEL ***',
'',
'A NOVEL', '',
'CONTENTS', '',
'CHAPTER I.', 'CHAPTER II. Another Day', 'PART ONE', '',
'A plain description of contents and the novel itself, together with a long and properly punctuated sentence.', '',
'PART ONE', '',
'CHAPTER I.', '',
'The Discovery', '',
'This is the opening paragraph. Nothing about these words is a heading.',
'Another part of the story follows on the next line.', '',
'The editor set each passage at a fixed width in an older paperback edition.',
'The second line continues that description, using the same natural language.',
'The third line should reflow more gently across a smaller phone screen.',
'The fourth line ends the paragraph, keeping the same lettering and tone.', '',
'Roses are red',
'Violets are blue',
'Verse lines must stay unchanged', '',
'* * *', '',
'CHAPTER II. Another Day', '',
'The Adventure Continues', '',
'Regular body text should remain in the classic reading font.',
'', 'EPILOGUE', '',
'The end. Project Gutenberg notices continue unchanged.',
'*** END OF THE PROJECT GUTENBERG EBOOK A NOVEL ***',''
].join('\n');
async function check(base,wide){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:wide?1360:390,height:820},reducedMotion:'reduce',isMobile:!wide,hasTouch:!wide});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/read?id=*',route=>route.fulfill({status:200,contentType:'text/plain',body:FIXTURE}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#booksGrid [data-open]').first().click();
  await page.locator('.reader-text').waitFor({timeout:18000});
  const content=await page.locator('.reader-text').evaluate(el=>el.textContent);
  assert.equal(content,FIXTURE,'No public-domain characters are lost or altered');
  const result=await page.locator('.reader-text').evaluate(el=>{
   const classes=['chapter','part','section','subtitle','scene','toc'];
   const styles={};for(const cl of classes){
    const node=el.querySelector('.reader-inbook-'+cl);
    styles[cl]=node?{count:el.querySelectorAll('.reader-inbook-'+cl).length,font:getComputedStyle(node).fontFamily,size:getComputedStyle(node).fontSize,text:node.textContent.trim().slice(0,65)}:null;
   }
   return {styles,flow:el.querySelectorAll('.reader-paragraph-flow').length,
    bodyFont:getComputedStyle(el).fontFamily,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  console.log(wide?'desktop':'phone',JSON.stringify(result));
  assert.ok(result.styles.chapter?.count>=1,'Detect body chapter markers');
  assert.ok(result.styles.toc?.count>=2,'Style contents entries more subtly');
  assert.ok(result.styles.part?.count>=1);
  assert.ok(result.styles.subtitle?.count>=1);
  assert.ok(result.styles.scene?.count>=1);
  assert.ok(result.styles.section?.count>=2);
  assert.ok(result.flow>=1,'Reflow hard-wrapped prose');
  assert.equal(await page.locator('.reader-paragraph-flow').first().evaluate(el=>getComputedStyle(el).whiteSpace),'normal');
  assert.notEqual(result.styles.chapter.font,result.bodyFont,'Chapter title must visually differ from body font');
  assert.ok(result.scrollWidth<=result.viewport+3);
  await page.locator('#toggleSettings').click();
  await page.locator('[data-font=sans]').click();await page.locator('[data-theme=night]').click();
  await page.locator('#toggleSettings').click();
  await page.locator('#readerSeek').fill('50');
  await page.locator('#bookmarkPosition').click();
  await page.locator('#closeReader').click();
  await page.locator('#booksGrid [data-open]').first().click();
  await page.locator('.reader-text').waitFor();
  assert.equal(await page.locator('.reader-text').evaluate(el=>el.textContent),FIXTURE,'Content survives reopen');
  assert.deepEqual(errors,[]);
  return true;
 }finally{await browser.close();}
}
(async()=>{await check(BASE,true);await check(BASE,false);console.log('TYPOGRAPHY CHECKS PASSED')})().catch(e=>{console.error('TYPOGRAPHY FAIL',e.stack?.slice(0,1800));process.exitCode=1});
