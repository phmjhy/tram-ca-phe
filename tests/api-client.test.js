import test from 'node:test';import assert from 'node:assert/strict';import {request} from '../src/api-client.js';
test('deadline covers stalled JSON body even after headers have arrived',{timeout:1000},async t=>{
 const timer=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',(fn,ms)=>timer(fn,ms===15000?5:ms));
 t.mock.method(globalThis,'fetch',async(_path,{signal})=>({status:200,ok:true,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('TEST stalled body')),{once:true}))}));
 await assert.rejects(request('/api/v1/me'),error=>error.status===200&&error.message.includes('Chưa xác nhận lưu'));
});
