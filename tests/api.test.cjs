'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const books=require('../api/books');
const read=require('../api/read');
const catalog=require('../data');
function res(){return {code:200,headers:{},body:null,status(n){this.code=n;return this},setHeader(k,v){this.headers[k]=v;return this},json(v){this.body=v;return this},send(v){this.body=v;return this}};}
test('catalog includes thousands of unique books',()=>{assert.ok(catalog.length>10000);assert.equal(new Set(catalog.map(b=>b[0])).size,catalog.length);});
test('invalid IDs are rejected before network access',async()=>{const r=res();await read({method:'GET',query:{id:'https://evil.com'}},r);assert.equal(r.code,400);});
test('read URLs are restricted to Project Gutenberg',()=>{assert.deepEqual(read.urlsFor('84'),['https://www.gutenberg.org/cache/epub/84/pg84.txt','https://www.gutenberg.org/ebooks/84.txt.utf-8']);});
test('books rejects malformed requested IDs',async()=>{const r=res();await books({method:'GET',query:{ids:'1,abc'}},r);assert.equal(r.code,400);});
test('books returns 25 records paginated',async()=>{const r=res();await books({method:'GET',query:{page:1}},r);assert.equal(r.code,200);assert.equal(r.body.results.length,25);assert.equal(r.body.next,true);assert.equal(r.body.results[0].title,'Pride and Prejudice');});
test('title search finds Frankensteins ID',async()=>{const r=res();await books({method:'GET',query:{search:'frankenstein'}},r);assert.equal(r.code,200);assert.ok(r.body.results.some(b=>b.id===84));});
test('genre filters apply to records',async()=>{const r=res();await books({method:'GET',query:{topic:'Mystery'}},r);assert.equal(r.code,200);assert.ok(r.body.count>1);});
test('book reading preserves full Gutenberg text',async()=>{const old=global.fetch;global.fetch=async()=>({ok:true,status:200,headers:{get:()=> 'text/plain'},text:async()=>'Full Project Gutenberg work with license'});try{const r=res();await read({method:'GET',query:{id:'84'}},r);assert.equal(r.code,200);assert.equal(r.body,'Full Project Gutenberg work with license');}finally{global.fetch=old;}});
test('reader handles missing text edition with fallback',async()=>{const old=global.fetch;global.fetch=async()=>({ok:false,status:404});try{const r=res();await read({method:'GET',query:{id:'8'}},r);assert.equal(r.code,415);}finally{global.fetch=old;}});

test('search finds books using noncontiguous title words',async()=>{const r=res();await books({method:'GET',query:{search:'alice wonderland'}},r);assert.equal(r.code,200);assert.ok(r.body.results.some(book=>book.id===11));});
