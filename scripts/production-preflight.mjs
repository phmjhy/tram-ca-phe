// Strictly read-only; no migration, bootstrap, import or backup restore here.
import {stat,readFile} from 'node:fs/promises';import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import pg from 'pg';
const file='.env.production-readonly.local',expectedBranch='br-old-haze-b8fmcrjs';
let client;
const report={scope:'PRODUCTION_READ_ONLY',expectedBranch,database:'neondb',status:'BLOCKED'};
try{
 const info=await stat(file);if(!info.isFile()||(info.mode&0o777)!==0o600||info.uid!==process.getuid())throw Object.assign(Error(),{code:'PRIVATE_FILE_PERMISSIONS'});
 execFileSync('git',['check-ignore','--quiet',file]);
 const env=parseEnv(await readFile(file,'utf8'));if(env.APP_ENV!=='production'||!env.DATABASE_URL)throw Object.assign(Error(),{code:'PRODUCTION_CONFIG_REQUIRED'});
 const url=new URL(env.DATABASE_URL);if(!url.hostname.endsWith('.neon.tech')||url.hostname.includes('-pooler')||url.pathname!=='/neondb')throw Object.assign(Error(),{code:'DIRECT_NEON_DATABASE_REQUIRED'});
 url.searchParams.set('sslmode','verify-full');
 client=new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15000});await client.connect();
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='15s'");
 const identity=(await client.query("SELECT current_database() db,current_setting('neon.branch_id',true) branch,current_setting('transaction_read_only') readonly,current_setting('server_version') version")).rows[0];
 if(identity.db!=='neondb'||identity.branch!==expectedBranch||identity.readonly!=='on')throw Object.assign(Error(),{code:'PRODUCTION_IDENTITY_MISMATCH'});
 report.identity=identity;
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 report.tables=[];for(const {tablename} of tables){const identifier='"'+tablename.replaceAll('"','""')+'"';const row=(await client.query(`SELECT count(*)::text n FROM public.${identifier}`)).rows[0];report.tables.push({table:tablename,rows:row.n});}
 report.migrations=[];if(tables.some(t=>t.tablename==='schema_migrations')){
  const migrations=(await client.query('SELECT name,checksum FROM schema_migrations ORDER BY name')).rows;
  for(const migration of migrations){if(!/^00[0-2][^/]*\.sql$/.test(migration.name))throw Object.assign(Error(),{code:'UNREVIEWED_MIGRATION'});const expected=createHash('sha256').update(await readFile(new URL('../migrations/'+migration.name,import.meta.url))).digest('hex');report.migrations.push({name:migration.name,checksumMatch:expected===migration.checksum});}
  if(report.migrations.some(m=>!m.checksumMatch))throw Object.assign(Error(),{code:'MIGRATION_CHECKSUM_MISMATCH'});
 }
 await client.query('ROLLBACK');report.status='PASS';
}catch(error){report.code=error.code||'PREFLIGHT_FAILED';report.next=error.code==='ENOENT'?'Owner supplies private gitignored .env.production-readonly.local (600), DATABASE_URL direct to Production neondb and APP_ENV=production; never paste credentials into chat.':'Review private configuration/identity before any Production action.';process.exitCode=2;}
finally{await client?.end().catch(()=>{});console.log(JSON.stringify(report));}
