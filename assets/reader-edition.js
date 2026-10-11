'use strict';
/* Gutenberg markup is not trusted. No HTML node or attribute is adopted:
   selected text/image nodes are reconstructed using a strict whitelist. */
(function(){
 const ALLOWED=new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','PRE','UL','OL','LI','EM','I','STRONG','B','SMALL','SUP','SUB','TABLE','TBODY','THEAD','TR','TD','TH','SPAN','FIGURE','FIGCAPTION','IMG','HR','BR','DL','DT','DD']);
 const SKIP=new Set(['SCRIPT','STYLE','LINK','META','IFRAME','OBJECT','EMBED','SVG','CANVAS','VIDEO','AUDIO','FORM','INPUT','BUTTON','SELECT','NOSCRIPT','TEMPLATE','HEADER','FOOTER','NAV']);
 const CHAPTER=/^(?:chapter|book|part|letter|canto|scene|adventure|volume|act|stave)\s+(?:[ivxlcdm\d]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
 function imageURL(raw,id){
  if(!raw||typeof raw!=='string'||raw.length>260)return null;
  try{
   const url=new URL(raw,'https://www.gutenberg.org/cache/epub/'+id+'/pg'+id+'-images.html');
   if(url.protocol!=='https:'||url.hostname!=='www.gutenberg.org')return null;
   const path=decodeURIComponent(url.pathname);
   if(!(path.startsWith('/cache/epub/'+id+'/')||path.startsWith('/files/'+id+'/')))return null;
   if(!/\.(jpe?g|png|gif|webp)$/i.test(path))return null;
   return url.origin+url.pathname;
  }catch{return null;}
 }
 function readText(node){return String(node?.textContent||'').trim().replace(/\s+/g,' ').slice(0,150);}
 function startNodes(body){
  const nodes=[...body.children].filter(el=>!SKIP.has(el.tagName)&&!el.classList.contains('pg-boilerplate')&&!el.id.startsWith('pg-header'));
  const chapter=nodes.findIndex(el=>{
   const h=el.matches('h1,h2,h3')?el:el.matches('div.chapter,section.chapter')?el.querySelector('h1,h2,h3'):null;
   return h&&CHAPTER.test(readText(h));
  });
  if(chapter>=0)return nodes.slice(chapter);
  const title=nodes.findIndex(el=>el.matches('h1'));
  if(title>=0)return nodes.slice(title);
  const para=nodes.findIndex(el=>el.matches('p,div,section')&&readText(el).length>80);
  return para>=0?nodes.slice(para):nodes;
 }
 function safe(source,id,depth=0){
  if(depth>56)return document.createDocumentFragment();
  if(source.nodeType===Node.TEXT_NODE)return document.createTextNode(source.nodeValue||'');
  if(source.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
  const tag=source.tagName.toUpperCase();
  if(SKIP.has(tag)||source.classList.contains('pg-boilerplate')||source.classList.contains('pagenum')||source.classList.contains('transnote')||source.id.startsWith('pg-footer'))return document.createDocumentFragment();
  if(tag==='IMG'){
   const alt=(source.getAttribute('alt')||'').trim();
   const url=imageURL(source.getAttribute('src'),id);
   if(!url)return document.createTextNode(alt.length<=40?alt:'');
   if(/^[a-z]$/i.test(alt))return document.createTextNode(alt);
   const image=document.createElement('img');
   image.src=url;image.alt=alt||'Original book illustration';
   image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
   const w=Number(source.getAttribute('width')),h=Number(source.getAttribute('height'));
   if(w>0&&w<5000)image.width=w;if(h>0&&h<5000)image.height=h;
   image.className='edition-art';
   return image;
  }
  const cl=source.classList;
  let name=ALLOWED.has(tag)?tag.toLowerCase():'span';
  if(tag==='A')name='span'; // no links from untrusted HTML
  if(tag==='DIV'&&[...cl].some(x=>/^fig(center|left|right)?$|^image$|^illustration$/i.test(x)))name='figure';
  const target=document.createElement(name);
  if(/^h[1-6]$/.test(name))target.className='edition-heading';
  if(name==='figure')target.className='edition-figure';
  if([...cl].some(x=>/^(poem|poetry|verse|stanza)$/i.test(x)))target.classList.add('edition-poetry');
  if(cl.contains('chapter'))target.classList.add('edition-chapter');
  for(const child of source.childNodes)target.append(safe(child,id,depth+1));
  if(name==='p'&&!target.textContent.trim()&&!target.querySelector('img'))return document.createDocumentFragment();
  if(name==='figure'&&!target.querySelector('img')){
   const frag=document.createDocumentFragment();
   for(const node of [...target.childNodes])frag.append(node);
   return frag;
  }
  return target;
 }
 function render(html,id){
  if(typeof html!=='string'||html.length<130||html.length>8_000_000)return null;
  const parsed=new DOMParser().parseFromString(html,'text/html');
  if(!parsed.body)return null;
  for(const x of parsed.body.querySelectorAll('header.pg-header,footer.pg-footer,.pg-boilerplate,.pagenum,.transnote,[id^="pg-header"],[id^="pg-footer"]'))x.remove();
  const nodes=startNodes(parsed.body);
  if(!nodes.length)return null;
  const doc=document.createElement('div');doc.className='reader-text reader-formatted-edition';doc.dataset.edition='gutenberg-html';
  let group=document.createElement('div');group.className='reader-text-block';let length=0,total=0;
  for(const node of nodes){
   const safeCopy=safe(node,id),size=safeCopy.textContent.length;
   if(length>=11000&&node.matches('div,section,h2,p')){
    doc.append(group);group=document.createElement('div');group.className='reader-text-block';length=0;
   }
   group.append(safeCopy);length+=size;total+=size;
  }
  if(group.childNodes.length)doc.append(group);
  if(total<210||doc.querySelectorAll('p,blockquote,pre,li').length<2)return null;
  doc.dataset.imageCount=String(doc.querySelectorAll('img.edition-art').length);
  return doc;
 }
 window.LeaflightEdition={render};
})();
