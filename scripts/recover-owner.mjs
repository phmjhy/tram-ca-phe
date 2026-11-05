import pg from 'pg';import {configuration} from '../server/config.js';import {createAuth} from '../server/auth.js';import {recoverOwner} from '../server/account-operator.js';
if(process.env.VERCEL_ENV==='production'||!['test','development','preview'].includes(process.env.APP_ENV))throw Error('Production recovery blocked; reviewed operator approval required.');
if(!process.env.POS_USER_EMAIL||!process.env.POS_USER_PASSWORD)throw Error('Supply private POS_USER_EMAIL/PASSWORD; never pass password as CLI argument.');
const config=configuration(),pool=new pg.Pool({connectionString:config.databaseUrl,connectionTimeoutMillis:15000});
try{await recoverOwner(pool,createAuth(pool,config),{email:process.env.POS_USER_EMAIL,password:process.env.POS_USER_PASSWORD},{target:process.env.APP_ENV});console.log('OWNER credential replaced; sessions revoked; audit recorded. Credentials not logged.');}
catch(error){console.error('Recovery stopped.',error.status||error.code||'OPERATOR_FAILED');process.exitCode=1;}finally{await pool.end();}
