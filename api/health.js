'use strict';
const catalog=require('../data');
module.exports=async(req,res)=>{
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  let source='unavailable';
  try{const r=await fetch('https://www.gutenberg.org/cache/epub/84/pg84.txt',{method:'HEAD',signal:AbortSignal.timeout(7000)});source=r.status;}catch{}
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({catalogBooks:catalog.length,gutenbergStatus:source});
};
