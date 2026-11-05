import pg from 'pg';
import { configuration } from '../server/config.js';
import { createAuth } from '../server/auth.js';
import { provisionAccount } from '../server/account-operator.js';
const config=configuration();
const {POS_USER_EMAIL:email,POS_USER_PASSWORD:password,POS_USER_NAME:name,POS_USER_ROLE:role}=process.env;
if(!email||!password||!name||!['owner','staff'].includes(role))throw new Error('Set POS_USER_EMAIL/PASSWORD/NAME/ROLE privately; password >=12 characters. No public signup.');
if(process.env.VERCEL_ENV==='production'||!['development','test','preview'].includes(process.env.APP_ENV))throw new Error('Production bootstrap requires a reviewed operator runbook.');
const pool=new pg.Pool({connectionString:config.databaseUrl});
try{
 const auth=createAuth(pool,config);
 await provisionAccount(pool,auth,{email,password,name,role},{target:process.env.APP_ENV});
 console.log('Account provisioned. Credentials not logged.');
}catch(error){console.error('Provisioning stopped.',error.status||error.code||'OPERATOR_FAILED');process.exitCode=1;}finally{await pool.end();}
