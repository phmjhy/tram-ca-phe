import { startTestDatabase } from './postgres.js';
import { randomBytes } from 'node:crypto';
import { createAuth } from '../../server/auth.js';
import { createApp } from '../../server/app.js';
import { migrate } from '../../server/migrate.js';
export async function environment(origin='http://127.0.0.1:4176') {
 const db=await startTestDatabase();await migrate(db.pool,{target:'test'});await migrate(db.pool,{target:'test'});
 const config={origin,secret:randomBytes(48).toString('base64url')};const provision=createAuth(db.pool,config,{provisioning:true});
 const accounts={};
 for(const role of ['owner','staff','other']){
  const email=`test-${role}@example.test`,password=randomBytes(24).toString('base64url');
  const result=await provision.api.signUpEmail({body:{name:`TEST ${role}`,email,password}});
  await db.pool.query('INSERT INTO user_access(user_id,role) VALUES($1,$2)',[result.user.id,role==='owner'?'owner':'staff']);
  accounts[role]={id:result.user.id,email,password};
 }
 const auth=createAuth(db.pool,config);const app=createApp({pool:db.pool,auth,origin,build:'TEST-BUILD'});
 async function call(path,{method='GET',body,cookie,key,headers={}}={}) {
  const response=await app(new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json','X-Tram-Request':'1',...(cookie?{Cookie:cookie}:{}),...(key?{'Idempotency-Key':key}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:response.status,data:await response.clone().json(),response};
 }
 async function login(role){const {email,password}=accounts[role];const result=await call('/api/auth/sign-in/email',{method:'POST',body:{email,password}});if(result.status!==200)throw new Error('Test login failed, status '+result.status);return result.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
 return {...db,accounts,auth,app,call,login,config};
}
