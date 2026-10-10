'use strict';
const catalog=require('../data');
function displayAuthor(raw){
  const parts=raw.split(',').map(s=>s.trim()).filter(s=>s&&!/^\d{4}(-\d{4})?$/.test(s));
  if(parts.length===2 && !/^(Jr|Sr|II|III|IV)$/i.test(parts[1]))return parts[1]+' '+parts[0];
  return parts.slice(0,2).join(', ')||'Unknown author';
}
const TAGS={'Fiction':1,'Adventure':2,'Mystery':4,'Science fiction':8,'Romance':16,'Poetry':32,'History':64};
module.exports = async function books(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const page=Math.max(1,Math.min(2000,Number.parseInt(req.query.page,10)||1));
  const search=String(req.query.search||'').trim().slice(0,120).toLowerCase();
  const words=search.split(/\s+/).filter(Boolean);
  const topic=String(req.query.topic||'').trim().slice(0,60);
  const ids=String(req.query.ids||'').trim();
  if(ids&&!/^\d{1,7}(,\d{1,7}){0,19}$/.test(ids))return res.status(400).json({error:'Invalid book IDs'});
  const requested=ids?new Set(ids.split(',').map(Number)):null;
  const topicFlag=TAGS[topic]||0;
  const results=[];
  for(const row of catalog){
    if(requested&&!requested.has(row[0]))continue;
    if(topicFlag&&!(row[4]&topicFlag))continue;
    if(words.length){const haystack=(row[1]+' '+row[2]+' '+row[3]).toLowerCase();if(!words.every(word=>haystack.includes(word)))continue;}
    results.push(row);
  }
  const count=results.length;
  const limit=25;
  const slice=results.slice((page-1)*limit,page*limit).map(([id,title,author,subjects,tags,image])=>({
    id,title,authors:[{name:displayAuthor(author||'Unknown author')}],subjects:subjects?[subjects]:[],languages:['en'],downloads:0,image:image||''
  }));
  res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({count,next:page*limit<count,results:slice});
};
