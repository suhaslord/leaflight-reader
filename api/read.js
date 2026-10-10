'use strict';
const urlsFor=id=>[
  'https://www.gutenberg.org/cache/epub/'+id+'/pg'+id+'.txt',
  'https://www.gutenberg.org/ebooks/'+id+'.txt.utf-8'
];
module.exports=async function read(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  const id=String(req.query.id||'');
  if(!/^[1-9]\d{0,6}$/.test(id))return res.status(400).send('Invalid book ID');
  let failed=false;
  for(const url of urlsFor(id)){
    try{
      const remote=await fetch(url,{
        headers:{Accept:'text/plain', 'User-Agent':'LeaflightReader/1.0'},
        signal:AbortSignal.timeout(15000)
      });
      if(remote.status===404||remote.status===410)continue;
      if(!remote.ok){failed=true;continue;}
      const len=Number(remote.headers.get('content-length')||0);
      const type=remote.headers.get('content-type')||'';
      if(len>7_000_000)return res.status(413).send('Book too large');
      if(type&&!/text\/plain|octet-stream/i.test(type)){failed=true;continue;}
      const text=await remote.text();
      if(text.length>7_000_000)return res.status(413).send('Book too large');
      if(!text.trim()){failed=true;continue;}
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(text);
    }catch(err){failed=true;console.error('Gutenberg source unavailable:',err.message);}
  }
  return res.status(failed?502:415).send('This text edition is unavailable. Open the original Project Gutenberg page instead.');
};
module.exports.urlsFor=urlsFor;
