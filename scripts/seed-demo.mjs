import pg from 'pg';
import {seedDemo} from '../server/demo.js';
if(!['test','development'].includes(process.env.APP_ENV)||process.env.VERCEL_ENV||process.env.CONFIRM_DEMO!=='YES'||!process.env.DATABASE_URL||!process.env.DEMO_OWNER_EMAIL)throw new Error('DEMO seed only: local test/development, explicit CONFIRM_DEMO and owner email required.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{const owner=(await pool.query('SELECT u.id FROM "user" u JOIN user_access a ON a.user_id=u.id WHERE u.email=$1 AND a.role=\'owner\' AND a.active',[process.env.DEMO_OWNER_EMAIL])).rows[0];if(!owner)throw new Error('Provision a DEMO owner first.');await seedDemo(pool,owner.id);console.log('DEMO seed committed to isolated database.');}finally{await pool.end();}
