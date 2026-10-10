'use strict';
const {chromium}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  let checks=0,violations=0;
  try{
    for(const [layout,width] of [['desktop',1440],['mobile',390]]){
      const context=await browser.newContext({viewport:{width,height:880},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
      const page=await context.newPage();
      await page.goto(BASE,{waitUntil:'domcontentloaded'});
      await page.locator('#booksGrid .book-card').first().waitFor();
      const audit=async(label)=>{
        const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
        checks++;violations+=result.violations.length;
        console.log(layout,label,'violations',result.violations.length,result.violations.map(v=>v.id+': '+v.nodes.map(n=>n.target.join(' ')).slice(0,4).join(', ')).join('; '));
      };
      await audit('home');
      await page.locator(width<500?'.mobile-link[data-page=explore]':'.side-nav [data-page=explore]').click();
      await page.locator('#booksGrid .book-card').first().waitFor();
      await audit('explore');
      await page.locator(width<500?'.mobile-link[data-page=library]':'.side-nav [data-page=library]').click();
      await audit('library');
      await page.locator(width<500?'.mobile-link[data-page=home]':'.side-nav [data-page=home]').click();
      await page.locator('#booksGrid .book-card').first().waitFor();
      await page.locator('#booksGrid [data-open]').first().click();
      await page.locator('.reader-text').waitFor({timeout:26000});
      for(const theme of ['paper','sepia','night']){
        await page.locator('#toggleSettings').click();
        await page.locator('.reader-settings button[data-theme="'+theme+'"]').click();
        await audit('reader-'+theme+'-settings-open');
        await page.locator('#toggleSettings').click();
        await audit('reader-'+theme);
      }
      await context.close();
    }
  }finally{await browser.close()}
  console.log('ACCESSIBILITY',checks,'audits',violations,'violations');
  if(violations)process.exitCode=1;
})();
