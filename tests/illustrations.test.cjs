'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/illustrations/1342.json');
test('illustrated Pride and Prejudice manifest is complete and safe',()=>{
 assert.equal(manifest.images.length,162);
 assert.equal(manifest.images.filter(item=>item.kind==='illustration').length,36);
 assert.equal(manifest.images.filter(item=>item.kind==='chapter-art').length,63);
 assert.equal(manifest.images.filter(item=>item.kind==='ornament').length,63);
 for(const item of manifest.images){
  assert.match(item.url,/^https:\/\/www\.gutenberg\.org\/cache\/epub\/1342\/images\/[A-Za-z0-9_.-]+$/);
  assert.ok(Number.isFinite(item.width)&&item.width>=0);
  assert.ok(Number.isFinite(item.height)&&item.height>=0);
  if(item.kind!=='ornament')assert.ok(item.width>0&&item.height>0);
 }
});
