'use strict';
const catalog=require('../data/catalog.cjs');
const {displayAuthor}=require('./books');
const TAGS=[
  {flag:1,words:['fiction','novel','story','stories','literature','classic']},
  {flag:2,words:['adventure','journey','travel','exploration','sea','pirates','quest','wilderness','survival','ocean','ship']},
  {flag:4,words:['mystery','detective','crime','sherlock','investigation','clue','puzzle','whodunit']},
  {flag:8,words:['science fiction','sci fi','scifi','space','future','robots','time travel','alien','technology','scientific']},
  {flag:16,words:['romance','romantic','love','relationship','heartwarming']},
  {flag:32,words:['poetry','poem','verse','lyrical','rhymes']},
  {flag:64,words:['history','historical','war','ancient','medieval','biography','past']}
];
const EXPANSIONS={
  cozy:['gentle','children','family','home','friendship','village','anne','secret garden','little women'],
  relaxing:['quiet','gentle','nature','friendship','poems','village'],
  comfort:['family','friendship','anne','little women'],
  funny:['humor','comedy','satire','comic','wodehouse','jerome'],
  humorous:['humor','comedy','satire','comic'],
  scary:['horror','gothic','ghost','dracula','frankenstein','haunted'],
  creepy:['horror','gothic','ghost','dracula','frankenstein'],
  dark:['gothic','horror','crime','dracula','frankenstein','dostoyevsky'],
  suspense:['detective','crime','mystery','thriller'],
  magical:['fantasy','fairy','wonderland','wizard','magic'],
  fantasy:['fantasy','fairy','wonderland','magic','myth'],
  philosophical:['philosophy','meditations','ethics','plato','nietzsche'],
  deep:['philosophy','dostoyevsky','tolstoy','existential'],
  psychology:['mind','psychology','dreams','human','dostoyevsky'],
  nature:['forest','nature','animals','mountains','garden','wild'],
  romance:['love','marriage','austen','pride'],
  romantic:['love','marriage','austen','pride'],
  short:['short stories','tales','story','fables'],
  thrilling:['adventure','mystery','horror','crime','pirates'],
  detective:['sherlock','holmes','poe','detective','mystery'],
  science:['scientific','discovery','science','wells','verne']
};
const STOP=new Set('i me my we our you your a an the in of to for with and or but on at by a book books read want like something about feels feel that is it be have me please find recommend good really very give kind this need looking as similar than easy'.split(' '));
function expand(prompt){
  const terms=prompt.toLowerCase().replace(/[^a-z0-9 -]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)).slice(0,25);
  return {terms,extras:terms.flatMap(w=>EXPANSIONS[w]||[]),types:TAGS.filter(t=>t.words.some(w=>prompt.toLowerCase().includes(w)))};
}
function scoreRows(prompt){
  const {terms,extras,types}=expand(prompt);
  return catalog.map((row,index)=>{
    const [,title,author,subject,tags]=row;
    const t=title.toLowerCase(),a=author.toLowerCase(),s=subject.toLowerCase();
    let score=0;
    for(const word of terms){if(t.includes(word))score+=8;if(a.includes(word))score+=5;if(s.includes(word))score+=1.7;}
    for(const word of extras){if(t.includes(word))score+=3.8;if(s.includes(word))score+=1.0;}
    for(const type of types){if(tags&type.flag)score+=9;}
    if(index<120)score+=Math.max(0,4-index/35);
    if(/\bshort\b/.test(prompt)&&/tales|stories|fables|poems/i.test(title))score+=3;
    return {row,index,score};
  }).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,42);
}
function asBook(row){return {id:row[0],title:row[1],authors:[{name:displayAuthor(row[2])}],subjects:row[3]?[row[3]]:[],languages:['en'],image:row[5]||'',downloads:0};}
function reason(row,prompt){
  const title=row[1].toLowerCase(),subject=row[3].toLowerCase();
  const {terms,extras,types}=expand(prompt);
  const match=terms.find(w=>title.includes(w)||subject.includes(w))||extras.find(w=>title.includes(w)||subject.includes(w));
  if(match)return 'A good match for your interest in '+match+'.';
  const type=types.find(t=>row[4]&t.flag);
  if(type)return 'A timeless pick in the '+type.words[0]+' collection.';
  return 'An enduring classic worth exploring.';
}
async function askAI(prompt,candidates){
  if(!process.env.HF_TOKEN)return null;
  const shortlist=candidates.slice(0,24).map(x=>({id:x.row[0],title:x.row[1],author:displayAuthor(x.row[2]),subjects:x.row[3].slice(0,80)}));
  const instructions='You are Leaflight, a friendly book librarian. Select 3 to 5 books ONLY from the supplied candidate list that fit the reader request. Give honest reasons, never invent a book. Return strict JSON with keys intro (one conversational sentence) and picks (array of objects with id NUMBER and reason STRING of at most 18 words). Do not use markdown.';
  const response=await fetch('https://router.huggingface.co/v1/chat/completions',{
    method:'POST',headers:{Authorization:'Bearer '+process.env.HF_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.HF_MODEL||'Qwen/Qwen3-4B-Instruct-2507:cheapest',messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({request:prompt,candidates:shortlist})}],temperature:0.5,max_tokens:340,stream:false}),
    signal:AbortSignal.timeout(11500)
  });
  if(!response.ok)throw Error('Inference provider returned '+response.status);
  const data=await response.json();
  let raw=data?.choices?.[0]?.message?.content;
  if(typeof raw!=='string')throw Error('Invalid AI response');
  raw=raw.replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'').trim();
  const parsed=JSON.parse(raw);
  const allowed=new Set(shortlist.map(item=>item.id));
  const dedup=new Set();
  const picks=(Array.isArray(parsed.picks)?parsed.picks:[]).filter(p=>Number.isInteger(p.id)&&allowed.has(p.id)&&!dedup.has(p.id)&&dedup.add(p.id)).slice(0,5);
  if(!picks.length)throw Error('No grounded picks');
  return {mode:'ai',intro:String(parsed.intro||'I found a few ideas for you.').slice(0,200),picks:picks.map(item=>({book:asBook(catalog.find(row=>row[0]===item.id)),reason:String(item.reason||'Recommended for your reading mood.').slice(0,170)}))};
}
let windowStart=Date.now(),requestCount=0;
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const prompt=String(req.body?.prompt||'').trim().slice(0,320);
  if(prompt.length<3)return res.status(400).json({error:'Describe the kind of book you want in a few words.'});
  res.setHeader('Cache-Control','no-store');
  const ranked=scoreRows(prompt);
  const defaultResponse={mode:'matching',intro:'Here are a few stories that match what you described.',picks:ranked.slice(0,5).map(({row})=>({book:asBook(row),reason:reason(row,prompt)}))};
  if(!process.env.HF_TOKEN)return res.status(200).json(defaultResponse);
  if(Date.now()-windowStart>60000){windowStart=Date.now();requestCount=0;}
  if(++requestCount>25)return res.status(200).json(defaultResponse);
  try{return res.status(200).json(await askAI(prompt,ranked)||defaultResponse);}
  catch(e){console.warn('AI recommendation fallback:',e.message);return res.status(200).json(defaultResponse);}
};
module.exports.scoreRows=scoreRows;
module.exports.asBook=asBook;
