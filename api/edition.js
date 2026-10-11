'use strict';
// HTML is delivered as inert plain text and selectively rebuilt by the client.
module.exports=async function edition(req,res){
 if(req.method!=='GET')return res.status(405).send('Method not allowed');
 const id=String(req.query.id||'');
 if(!/^[1-9]\d{0,6}$/.test(id))return res.status(400).send('Invalid book ID');
 const urls=[
  'https://www.gutenberg.org/cache/epub/'+id+'/pg'+id+'-images.html',
  'https://www.gutenberg.org/files/'+id+'/'+id+'-h/'+id+'-h.htm'
 ];
 let failed=false;
 for(const url of urls){
  try{
   const response=await fetch(url,{
    headers:{Accept:'text/html','User-Agent':'LeaflightReader/1.0'},
    signal:AbortSignal.timeout(12000)
   });
   if([404,406,410].includes(response.status))continue;
   if(!response.ok){failed=true;continue;}
   const len=Number(response.headers.get('content-length')||0);
   const mime=response.headers.get('content-type')||'';
   if(len>8_000_000||!/text\/html/i.test(mime)){failed=true;continue;}
   const html=await response.text();
   if(html.length>8_000_000||!/<body[\s>]/i.test(html)){failed=true;continue;}
   res.setHeader('Content-Type','text/plain; charset=utf-8');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Cache-Control','public, s-maxage=604800, stale-while-revalidate=604800');
   return res.status(200).send(html);
  }catch(err){failed=true;console.error('Gutenberg edition fetch:',id,err.message);}
 }
 return res.status(failed?502:415).send('HTML edition unavailable');
};
