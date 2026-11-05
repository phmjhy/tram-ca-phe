// Operator-only library: no HTTP endpoint. Production remains explicitly blocked.
import {randomUUID} from 'node:crypto';import {transaction} from './service.js';
import {HttpError,text} from './validation.js';import {log} from './management.js';
async function guard(pool,target){
 if(!['test','development','preview'].includes(target))throw new HttpError(403,'Production operator requires separate reviewed approval.');
 const host=pool.options?.connectionString?new URL(pool.options.connectionString).hostname:pool.options?.host;
 if(target!=='preview'&&!['localhost','127.0.0.1','::1'].includes(host))throw new HttpError(403,'Local operator requires loopback database.');
 const {branch}=(await pool.query("SELECT current_setting('neon.branch_id',true) branch")).rows[0];
 if(target==='preview'?branch!=='br-bitter-butterfly-b8nl03v0':Boolean(branch))throw new HttpError(403,'Operator database identity mismatch.');
}
async function hash(auth,password){if(typeof password!=='string'||password.length<12||password.length>128)throw new HttpError(422,'Mật khẩu cần12–128 ký tự.');return (await auth.$context).password.hash(password);}
export async function provisionAccount(pool,auth,{email,name,password,role},{target}={}){
 await guard(pool,target);email=text(email,254,true).toLowerCase();name=text(name,120,true);
 if(!['owner','staff'].includes(role)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(422,'Thông tin tài khoản không hợp lệ.');
 const passwordHash=await hash(auth,password);
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['operator-account:'+email]);
  if((await db.query('SELECT id FROM "user" WHERE lower(email)=$1',[email])).rowCount)throw new HttpError(409,'Tài khoản đã tồn tại; kiểm tra đăng nhập trước khi thử lại.');
  const id=randomUUID();await db.query('INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,false,now(),now())',[id,name,email]);
  await db.query('INSERT INTO account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,\'credential\',$2,$3,now(),now())',[randomUUID(),id,passwordHash]);
  await db.query('INSERT INTO user_access(user_id,role) VALUES($1,$2)',[id,role]);await log(db,{id},'operator.account-create',id,{role});return {id};
 });
}
export async function recoverOwner(pool,auth,{email,password},{target}={}){
 await guard(pool,target);email=text(email,254,true).toLowerCase();const passwordHash=await hash(auth,password);
 return transaction(pool,async db=>{
  const users=(await db.query('SELECT u.id,a.role FROM "user" u JOIN user_access a ON a.user_id=u.id WHERE lower(u.email)=$1 FOR UPDATE',[email])).rows;
  if(users.length!==1||users[0].role!=='owner')throw new HttpError(403,'Chỉ khôi phục đúng OWNER đã xác minh.');
  const id=users[0].id;const r=await db.query('UPDATE account SET password=$2,"updatedAt"=now() WHERE "userId"=$1 AND "providerId"=\'credential\' RETURNING id',[id,passwordHash]);if(r.rowCount!==1)throw new HttpError(409,'Credential không duy nhất; dừng để đối soát.');
  await db.query('DELETE FROM session WHERE "userId"=$1',[id]);await db.query('UPDATE user_access SET active=true WHERE user_id=$1',[id]);await log(db,{id},'operator.owner-recovery',id);return {id};
 });
}
