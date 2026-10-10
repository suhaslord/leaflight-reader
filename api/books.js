'use strict';
module.exports = async function books(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const page=Math.max(1,Math.min(200,Number.parseInt(req.query.page,10)||1));
  const search=String(req.query.search||'').trim().slice(0,120);
  const topic=String(req.query.topic||'').trim().slice(0,60);
  const ids=String(req.query.ids||'').trim();
  if(ids&&!/^\d{1,7}(,\d{1,7}){0,19}$/.test(ids))return res.status(400).json({error:'Invalid book IDs'});
  const url=new URL('https://gutendex.com/books/');
  url.searchParams.set('languages','en');
  if(ids)url.searchParams.set('ids',ids);else{
    url.searchParams.set('page',String(page));
    if(search)url.searchParams.set('search',search);
    if(topic)url.searchParams.set('topic',topic);
  }
  try{
    const response=await fetch(url,{headers:{'Accept':'application/json'},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Catalog returned '+response.status);
    const data=await response.json();
    if(!Array.isArray(data.results))throw Error('Unexpected catalog response');
    const items=data.results.filter(b=>b&&b.copyright!==true).map(b=>({
      id:b.id,title:b.title,authors:b.authors||[],languages:b.languages||[],
      subjects:(b.subjects||[]).slice(0,12),downloads:b.download_count||0,
      image:b.formats?.['image/jpeg']||''
    }));
    res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=1800');
    return res.status(200).json({count:data.count||items.length,next:!!data.next,results:items});
  }catch(e){return res.status(502).json({error:'Book catalog temporarily unavailable'});}
};
