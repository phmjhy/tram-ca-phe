import pg from 'pg';
import { migrate } from '../server/migrate.js';
if(!process.env.DATABASE_URL||!process.env.APP_ENV)throw new Error('Set DATABASE_URL and APP_ENV in server environment; do not print values.');
if(process.env.VERCEL_ENV==='production'||process.env.APP_ENV==='production')throw new Error('Production migration blocked; use reviewed backup/restore runbook.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{await migrate(pool,{target:process.env.APP_ENV});console.log('Migration complete.');}finally{await pool.end();}
