'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const catalog=require('../data'),books=require('../api/books'),edition=require('../api/edition');
function response(){return {code:200,headers:{},status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v;return this},json(x){this.data=x;return this},send(x){this.data=x;return this}}}
test('full Gutenberg text catalog is represented by 78,282 unique books',()=>{
 assert.equal(catalog.length,78282);
 assert.equal(new Set(catalog.map(row=>row[0])).size,catalog.length);
 assert.ok(catalog.some(row=>row[6]==='fr'));
});
test('all catalog results have source-grounded Gutenberg cover URLs',async()=>{
 for(const options of [{},{language:'de'},{language:'fi'},{language:'en'},{page:'3132'}]){
  const r=response();await books({method:'GET',query:options},r);
  assert.equal(r.code,200);
  assert.ok(r.data.results.length>0);
  for(const book of r.data.results){
   assert.equal(book.image,'https://www.gutenberg.org/cache/epub/'+book.id+'/pg'+book.id+'.cover.medium.jpg');
   assert.ok(book.languages.length===1);
  }
 }
});
test('unsupported catalog language is rejected',async()=>{
 const r=response();await books({method:'GET',query:{language:'../../../etc'}},r);assert.equal(r.code,400);
});
test('formatted Gutenberg edition API accepts only numeric book IDs',async()=>{
 for(const id of ['https://wrong.test','../1','0','99999999']){
  const r=response();await edition({method:'GET',query:{id}},r);assert.equal(r.code,400);
 }
});
test('formatted Gutenberg editions are never sent as executable HTML',async()=>{
 const orig=global.fetch;
 global.fetch=async()=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'text/html; charset=utf-8':null},text:async()=>'<html><body><p>Gutenberg</p></body></html>'});
 try{
  const r=response();await edition({method:'GET',query:{id:'74'}},r);
  assert.equal(r.code,200);
  assert.equal(r.headers['Content-Type'],'text/plain; charset=utf-8');
  assert.match(r.data,/Gutenberg/);
 }finally{global.fetch=orig;}
});
