'use strict';
const {chromium}=require('playwright'),Axe=require('@axe-core/playwright').default;
(async()=>{
const id=Number(process.argv[2]||74),width=Number(process.argv[3]||390),BASE=process.env.BASE_URL||'http://127.0.0.1:4195';
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const ctx=await b.newContext({viewport:{width,height:850},reducedMotion:'reduce'}); const page=await ctx.newPage();
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const q={74:'Tom Sawyer',1342:'Pride and Prejudice',84:'Frankenstein'}[id]||'Tom Sawyer';
 await page.locator('#searchInput').fill(q);await page.locator('#searchInput').press('Enter');
 await page.waitForFunction(id=>!!document.querySelector('#booksGrid [data-open="'+id+'"]'),id,{timeout:15000});
 await page.locator('#booksGrid [data-open="'+id+'"]').click();
 await page.locator('.reader-formatted-edition').waitFor({timeout:30000});
 const res=await new Axe({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 console.log('AXE',id,width,'violations',res.violations.map(v=>({id:v.id,nodes:v.nodes.length,example:v.nodes[0]?.target})));
 if(res.violations.length)process.exitCode=1;
}finally{await b.close();}
})().catch(e=>{console.error('AXE FAILED',e.message);process.exitCode=1});
