import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
test('device export preserves raw malformed/legacy data, excludes credentials and never mutates storage',()=>{
 const rows=new Map([['tram_orders','{malformed original'],['tram_products','["TEST"]'],['tram_order_v2:abc','{"TEST":1}'],['tram_pending_sale:TEST','PRIVATE'],['auth-token','SECRET']]);
 const original=[...rows];let snapshot,clicked=false;
 vm.runInNewContext(fs.readFileSync(new URL('../scripts/export-legacy-browser.js',import.meta.url),'utf8'),{
  localStorage:{length:rows.size,key:i=>[...rows.keys()][i],getItem:key=>rows.get(key),setItem:()=>assert.fail('No writes'),removeItem:()=>assert.fail('No deletions')},
  location:{origin:'https://example.test'},Date,Blob:class{constructor(parts){snapshot=JSON.parse(parts[0]);}},URL:{createObjectURL:()=> 'blob:TEST',revokeObjectURL:()=>{}},
  document:{createElement:()=>({click(){clicked=true;}})},setTimeout:fn=>fn()
 });
 assert.ok(clicked);assert.deepEqual([...rows],original);assert.equal(snapshot.entries.length,3);assert.equal(snapshot.entries.find(e=>e.key==='tram_orders').raw,'{malformed original');assert.ok(!JSON.stringify(snapshot).includes('SECRET'));
});
