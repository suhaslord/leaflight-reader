'use strict';
function approvedTextUrl(value){
  try{const url=new URL(value);if(url.protocol!=='https:'||!['gutenberg.org','www.gutenberg.org','m.gutenberg.org'].includes(url.hostname))return false;return /\.txt(?:\.utf-8)?$/i.test(url.pathname);}catch{return false;}
}
module.exports = async function read(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  const id=String(req.query.id||'');
  if(!/^[1-9]\d{0,6}$/.test(id))return res.status(400).send('Invalid book ID');
  try{
    const catalog=await fetch('https://gutendex.com/books/'+id,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!catalog.ok)return res.status(404).send('Book not found');
    const book=await catalog.json();
    if(book.copyright===true)return res.status(403).send('This edition is not available in the reader');
    const formats=Object.entries(book.formats||{});
    const plain=formats.filter(([type,url])=>type.startsWith('text/plain')&&approvedTextUrl(url)&&!url.includes('.zip'));
    const preferred=plain.find(([type])=>/utf-8/i.test(type))||plain[0];
    if(!preferred)return res.status(415).send('Text edition unavailable; open the original book');
    const remote=await fetch(preferred[1],{headers:{'Accept':'text/plain','User-Agent':'LeaflightReader/1.0 (on-demand educational web reader)'},signal:AbortSignal.timeout(17000)});
    if(!remote.ok)throw Error('Book file unavailable');
    const contentLength=Number(remote.headers.get('content-length')||0);
    if(contentLength>6_000_000)return res.status(413).send('Book is too large for the reader');
    const text=await remote.text();
    if(text.length>6_000_000)return res.status(413).send('Book is too large for the reader');
    if(!text.trim())throw Error('Empty book');
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(text);
  }catch(e){return res.status(502).send('Book could not be loaded; try the original Project Gutenberg edition');}
};
module.exports.approvedTextUrl=approvedTextUrl;
