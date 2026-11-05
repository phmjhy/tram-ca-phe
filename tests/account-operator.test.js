import test from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {startTestDatabase} from './helpers/postgres.js';import {migrate} from '../server/migrate.js';import {createAuth} from '../server/auth.js';import {createApp} from '../server/app.js';import {provisionAccount,recoverOwner} from '../server/account-operator.js';
let db,auth,app,owner,ownerCookie;const origin='http://127.0.0.1:4176',email='test-operator-owner@example.test',password=randomBytes(24).toString('base64url'),next=randomBytes(24).toString('base64url');
test.before(async()=>{db=await startTestDatabase();await migrate(db.pool,{target:'test'});auth=createAuth(db.pool,{origin,secret:randomBytes(48).toString('base64url')});app=createApp({pool:db.pool,auth,origin});});test.after(async()=>{await db?.close();});
async function signIn(value){return app(new Request(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password:value})}));}
test('atomic operator provisioning uses Better Auth hash; concurrent duplicate creates one account',async()=>{
 const result=await Promise.allSettled([1,2].map(()=>provisionAccount(db.pool,auth,{email,name:'TEST operator',password,role:'owner'},{target:'test'})));
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);owner=result.find(r=>r.status==='fulfilled').value.id;
 assert.equal((await db.pool.query('SELECT count(*)::int n FROM account WHERE "userId"=$1',[owner])).rows[0].n,1);
 const response=await signIn(password);assert.equal(response.status,200);ownerCookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
});
test('OWNER recovery rotates credential, revokes own sessions, audits and old password fails',async()=>{
 await recoverOwner(db.pool,auth,{email,password:next},{target:'test'});
 assert.equal((await signIn(password)).status,401);assert.equal((await signIn(next)).status,200);
 assert.equal((await app(new Request(origin+'/api/v1/me',{headers:{Cookie:ownerCookie}}))).status,401);
 assert.equal((await db.pool.query("SELECT count(*)::int n FROM audit_logs WHERE action='operator.owner-recovery' AND entity_id=$1",[owner])).rows[0].n,1);
});
test('Production blocked before DB access; STAFF recovery and public signup forbidden',async()=>{
 await assert.rejects(recoverOwner({query:()=>assert.fail('Must not connect')},auth,{email,password:next},{target:'production'}),e=>e.status===403);
 const staffEmail='test-operator-staff@example.test';await provisionAccount(db.pool,auth,{email:staffEmail,name:'TEST staff',password,role:'staff'},{target:'test'});
 await assert.rejects(recoverOwner(db.pool,auth,{email:staffEmail,password:next},{target:'test'}),e=>e.status===403);
 assert.equal((await app(new Request(origin+'/api/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}))).status,403);
});
