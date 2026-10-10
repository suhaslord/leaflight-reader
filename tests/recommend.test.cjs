'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const recommend=require('../api/recommend');
function res(){return {code:200,headers:{},body:null,status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v;return this},json(v){this.body=v;return this}};}
test('book finder rejects invalid prompts',async()=>{let r=res();await recommend({method:'POST',body:{prompt:'  '}},r);assert.equal(r.code,400);});
test('book finder rejects GET',async()=>{let r=res();await recommend({method:'GET',body:{prompt:'mystery'}},r);assert.equal(r.code,405);});
test('book finder never invents books without a key',async()=>{const original=process.env.HF_TOKEN;delete process.env.HF_TOKEN;try{const r=res();await recommend({method:'POST',body:{prompt:'cozy mystery with detectives'}},r);assert.equal(r.code,200);assert.equal(r.body.mode,'matching');assert.equal(r.body.picks.length,5);assert.ok(r.body.picks.every(p=>Number.isInteger(p.book.id)&&p.book.title.length>1));}finally{if(original)process.env.HF_TOKEN=original;}});
test('book finder prioritizes mystery for detectives',()=>{const rows=recommend.scoreRows('detective mystery Sherlock Holmes');assert.ok(rows[0].score>10);assert.ok(rows.some(x=>/sherlock|holmes|detective/i.test(x.row[1]+' '+x.row[3])));});
test('book finder tolerates API provider error and uses fallback',async()=>{const orig=process.env.HF_TOKEN, fetch0=global.fetch;process.env.HF_TOKEN='test_fake_token';global.fetch=async()=>({ok:false,status:429});try{const r=res();await recommend({method:'POST',body:{prompt:'magical adventure fairy tales'}},r);assert.equal(r.code,200);assert.equal(r.body.mode,'matching');}finally{global.fetch=fetch0;if(orig)process.env.HF_TOKEN=orig;else delete process.env.HF_TOKEN;}});
