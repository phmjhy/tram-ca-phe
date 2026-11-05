import test from 'node:test';import assert from 'node:assert/strict';
import {journaledRequest,pendingMutations} from '../src/mutation-journal.js';
function storage(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('reload and lost response replay exactly the frozen body/key, scoped to actor',async()=>{
 const s=storage(),opts={method:'POST',key:crypto.randomUUID(),body:{quantity:'2',unitCost:'3'}};let calls=[];
 const context={actor:'TEST_OWNER',storage:s};
 await assert.rejects(journaledRequest('/api/v1/stock',opts,async(p,o)=>{calls.push(o);throw Object.assign(new Error(),{status:0});},context));
 assert.equal(pendingMutations('OTHER',s).length,0);assert.equal(pendingMutations('TEST_OWNER',s).length,1);
 await journaledRequest('/api/v1/stock',{...opts,key:crypto.randomUUID()},async(p,o)=>{calls.push(o);return {id:'TEST'};},context);
 assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);assert.equal(s.length,0);
});
test('unknown operation cannot be replaced by changed content, auth errors retain journal',async()=>{
 const s=storage(),context={actor:'TEST',storage:s},options={method:'POST',body:{amount:1}};
 await assert.rejects(journaledRequest('/api/v1/expenses',options,async()=>{throw Object.assign(new Error(),{status:401});},context));
 await assert.rejects(journaledRequest('/api/v1/expenses',{...options,body:{amount:2}},()=>assert.fail('Must not send'),context),e=>e.code==='PENDING_OPERATION');
 assert.equal(s.length,1);
});
test('quota failure blocks write; read and password operations never touch storage',async()=>{
 const context={actor:'TEST',get storage(){throw Error('denied');}};
 await assert.rejects(journaledRequest('/api/v1/stock',{method:'POST',body:{}},()=>assert.fail(),context),e=>e.code==='JOURNAL_UNAVAILABLE');
 for(const [path,method]of [['/api/v1/products','GET'],['/api/auth/sign-in/email','POST']])assert.equal(await journaledRequest(path,{method},async()=>true,context),true);
});
test('definitive validation failure releases draft; 5xx retains it',async()=>{
 const s=storage(),context={actor:'TEST',storage:s};
 for(const status of [503,422]){await assert.rejects(journaledRequest('/api/v1/ingredients',{method:'POST',body:{name:'TEST'}},async()=>{throw Object.assign(new Error(),{status});},context));assert.equal(s.length,status===503?1:0);}
});
