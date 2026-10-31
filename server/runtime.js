import pg from 'pg';
import { configuration } from './config.js';
import { createAuth } from './auth.js';
import { createApp } from './app.js';
let app;
export function getApp() {
 if(app)return app;
 const config=configuration();
 const pool=new pg.Pool({connectionString:config.databaseUrl,max:5,connectionTimeoutMillis:8000,idleTimeoutMillis:20000});
 const auth=createAuth(pool,config);
 app=createApp({pool,auth,origin:config.origin,build:process.env.VERCEL_GIT_COMMIT_SHA||'local'});return app;
}
