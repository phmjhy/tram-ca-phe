import fs from 'node:fs';import {parseEnv} from 'node:util';import assert from 'node:assert/strict';import pg from 'pg';
const {chromium}=await import(process.argv.find(a=>a.startsWith('--playwright='))?.slice(13)||'playwright');
const origin='https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app',report={scope:'FINAL Preview read-only business smoke',at:new Date().toISOString(),cases:[]};let pool,browser;
try{
 const c=parseEnv(fs.readFileSync('.env.preview.local','utf8'));assert.equal(c.APP_ENV,'preview');assert.equal(c.APP_ORIGIN,origin);
 pool=new pg.Pool({connectionString:c.DATABASE_URL,connectionTimeoutMillis:15000});assert.equal((await pool.query("SELECT current_setting('neon.branch_id',true) branch")).rows[0].branch,'br-bitter-butterfly-b8nl03v0');
 const token=fs.readFileSync(process.env.PREVIEW_AUTOMATION_TOKEN_FILE,'utf8').trim();assert.ok(token&&process.env.EXPECTED_PREVIEW_SHA);
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 const pages=[];
 for(const [role,width]of [['owner',1440],['staff',320]]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue({headers:{...r.request().headers(),'x-vercel-protection-bypass':token}}):r.continue());
  const p=await context.newPage();pages.push(p);const a=parseEnv(fs.readFileSync('.env.preview-'+role+'.local','utf8'));
  await p.goto(origin);await p.getByLabel('Email',{exact:true}).fill(a.POS_USER_EMAIL);await p.getByLabel('Mật khẩu',{exact:true}).fill(a.POS_USER_PASSWORD);await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();await p.getByRole('navigation').waitFor();
  const data=await p.evaluate(async()=>({version:await (await fetch('/api/v1/version')).json(),products:await (await fetch('/api/v1/products')).json(),inventory:(await fetch('/api/v1/inventory')).status}));
  assert.equal(data.version.build,process.env.EXPECTED_PREVIEW_SHA);assert.equal(data.inventory,role==='owner'?200:403);report.build=data.version.build;
  const sql=(await pool.query('SELECT id FROM products ORDER BY id')).rows.map(r=>r.id);assert.deepEqual(data.products.map(p=>p.id).sort(),sql);report.cases.push({name:role+' login/role/shared database/exact commit',status:'PASS'});
 }
 assert.notEqual((await pages[0].context().cookies()).find(c=>c.name.includes('session_token')).value,(await pages[1].context().cookies()).find(c=>c.name.includes('session_token')).value);report.status='PASS';
}catch(error){report.status='FAIL';report.code=error.code||'SMOKE_FAILED';process.exitCode=1;}finally{await browser?.close();await pool?.end();fs.writeFileSync('/private/tmp/tram-final-preview-smoke.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));}
