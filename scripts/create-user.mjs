import pg from 'pg';
import { configuration } from '../server/config.js';
import { createAuth } from '../server/auth.js';
const config=configuration();
const {POS_USER_EMAIL:email,POS_USER_PASSWORD:password,POS_USER_NAME:name,POS_USER_ROLE:role}=process.env;
if(!email||!password||!name||!['owner','staff'].includes(role))throw new Error('Set POS_USER_EMAIL/PASSWORD/NAME/ROLE privately; password >=12 characters. No public signup.');
if(process.env.VERCEL_ENV==='production'||!['development','test','preview'].includes(process.env.APP_ENV))throw new Error('Production bootstrap requires a reviewed operator runbook.');
const pool=new pg.Pool({connectionString:config.databaseUrl});
try{
 const auth=createAuth(pool,config,{provisioning:true});
 const result=await auth.api.signUpEmail({body:{email,password,name}});
 await pool.query('INSERT INTO user_access(user_id,role) VALUES($1,$2)',[result.user.id,role]);
 console.log('Account provisioned. Credentials not logged.');
}finally{await pool.end();}
