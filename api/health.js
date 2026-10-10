module.exports=async(req,res)=>{
if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
const urls=['https://gutendex.com/books/?languages=en&page=1','https://gutendex.com/books/84','https://www.gutenberg.org/cache/epub/84/pg84.txt'];
const items=await Promise.all(urls.map(async(url)=>{
try{const r=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'Mozilla/5.0 LeaflightChecker'},signal:AbortSignal.timeout(8000)});return {host:new URL(url).hostname,status:r.status,type:r.headers.get('content-type')};}
catch(e){return {host:new URL(url).hostname,error:e.message,cause:e.cause?.code||''};}
}));res.setHeader('Cache-Control','no-store');res.status(200).json({upstreams:items});};
