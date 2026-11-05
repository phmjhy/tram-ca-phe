// Preview TEST only. Never imports the business menu. Review journal before retry.
import fs from 'node:fs';import {parseEnv} from 'node:util';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
const {chromium}=await import(process.argv.find(a=>a.startsWith('--playwright='))?.slice(13)||'playwright');
const origin='https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app',report={scope:'REAL Preview TEST only',at:new Date().toISOString(),cases:[]};
let pool,browser,stage='configuration';const journal=process.env.CLOUD_STABILITY_JOURNAL||'/private/tmp/tram-cloud-stability-nov5-journal.json';
const pass=name=>{report.cases.push({name,status:'PASS'});console.log('PASS',name);};
try{
 const config=parseEnv(fs.readFileSync('.env.preview.local','utf8')),url=new URL(config.DATABASE_URL);
 assert.equal(config.APP_ENV,'preview');assert.equal(config.APP_ORIGIN,origin);assert.ok(!url.hostname.includes('-pooler')&&url.pathname==='/neondb');
 pool=new pg.Pool({connectionString:config.DATABASE_URL,connectionTimeoutMillis:15000});
 const identity=(await pool.query("SELECT current_database() db,current_setting('neon.branch_id',true) branch")).rows[0];assert.deepEqual(identity,{db:'neondb',branch:'br-bitter-butterfly-b8nl03v0'});report.database=identity;
 assert.ok(!fs.existsSync(journal),'Review previous run instead of duplicating TEST data');
 const token=fs.readFileSync(process.env.PREVIEW_AUTOMATION_TOKEN_FILE,'utf8').trim();assert.ok(token);
 const run=randomUUID().slice(0,8),name='TEST STABILITY '+run;
 fs.writeFileSync(journal,JSON.stringify({started:report.at,name}),{mode:0o600});
 const accounts=Object.fromEntries(['owner','staff'].map(role=>{const a=parseEnv(fs.readFileSync('.env.preview-'+role+'.local','utf8'));return [role,{email:a.POS_USER_EMAIL,password:a.POS_USER_PASSWORD}];}));
 const ingId='8a1177f8-2ac4-4981-a6de-0cdb9628b189';const ing=(await pool.query("SELECT * FROM ingredients WHERE id=$1 AND name LIKE 'TEST CLOUD %'",[ingId])).rows[0];assert.ok(ing);
 const original=(await pool.query('SELECT * FROM stock_movements ORDER BY id')).rows;
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 async function page(viewport){const context=await browser.newContext({viewport});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue({headers:{...route.request().headers(),'x-vercel-protection-bypass':token}}):route.continue());return context.newPage();}
 const pc=await page({width:1440,height:900}),staff=await page({width:320,height:640});
 const version=await pc.request.get(origin+'/api/v1/version',{headers:{'x-vercel-protection-bypass':token}});assert.equal(version.status(),200);const build=(await version.json()).build;assert.equal(build,process.env.EXPECTED_PREVIEW_SHA);report.build=build;
 async function login(p,a){await p.goto(origin);await p.getByLabel('Email',{exact:true}).fill(a.email);await p.getByLabel('Mật khẩu',{exact:true}).fill(a.password);await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();await p.getByRole('navigation').waitFor();}
 await login(pc,accounts.owner);await login(staff,accounts.staff);
 assert.deepEqual(await staff.getByRole('navigation').getByRole('button').allTextContents(),['Bán hàng','Ca làm']);assert.equal(await staff.evaluate(async()=>(await fetch('/api/v1/inventory')).status),403);pass('exact Preview build; independent OWNER/STAFF; STAFF403');
 async function nav(tab){await pc.getByRole('navigation').getByRole('button',{name:tab,exact:true}).click();}
 async function lost(path,submit,label){
  await pc.route('**/api/v1'+path,async route=>{if(route.request().method()==='POST'){await route.fetch({headers:{...route.request().headers(),'x-vercel-protection-bypass':token}});await route.abort('failed');}else await route.fallback();},{times:1});
  await submit();await pc.getByRole('alert').first().waitFor();await pc.reload();const button=pc.getByRole('button',{name:'Thử lại thao tác chờ '+label,exact:true});await button.waitFor();
  const wait=pc.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1'+path&&r.request().method()==='POST');await button.click();assert.equal((await wait).status(),201);await button.waitFor({state:'detached'});
 }
 stage='product_lost_response';await nav('Kho & Menu');await pc.getByLabel('Tên món',{exact:true}).fill(name);await pc.getByLabel('Giá bán (đ)',{exact:true}).fill('101');
 await lost('/products',()=>pc.getByRole('button',{name:'Lưu món',exact:true}).click(),'tạo món');assert.equal((await pool.query('SELECT count(*)::int n FROM products WHERE name=$1',[name])).rows[0].n,1);pass('cloud product response lost after commit: reload/replay once');
 stage='stock_lost_response';await nav('Kho & Menu');const form=pc.locator('form').filter({has:pc.locator('select[name=kind]')});await form.locator('select[name=ingredientId]').selectOption(ingId);await form.getByLabel('Lượng',{exact:true}).fill('3.5');await form.getByLabel('Đơn giá mỗi g/ml/cái (chỉ nhập hàng)',{exact:true}).fill(ing.unit_cost);
 const before=Number((await pool.query('SELECT stock FROM ingredients WHERE id=$1',[ingId])).rows[0].stock);
 await lost('/stock',()=>form.getByRole('button',{name:'Ghi kho',exact:true}).click(),'nhập/điều chỉnh kho');assert.equal(Number((await pool.query('SELECT stock FROM ingredients WHERE id=$1',[ingId])).rows[0].stock),before+3.5);pass('cloud stock response lost after commit: one purchase, not double');
 stage='expense_lost_response';await nav('Chi phí');await pc.getByLabel('Khoản mục',{exact:true}).fill(name);await pc.getByLabel('Số tiền (đ)',{exact:true}).fill('7');await lost('/expenses',()=>pc.getByRole('button',{name:'Lưu chi phí',exact:true}).click(),'ghi chi phí');assert.equal((await pool.query('SELECT count(*)::int n FROM expenses WHERE category=$1',[name])).rows[0].n,1);pass('cloud expense response lost after commit: one expense after reload');
 stage='session_expiry';const sessionId=await staff.evaluate(async()=> (await (await fetch('/api/auth/get-session')).json()).session.id);await pool.query('UPDATE session SET "expiresAt"=now()-interval \'1 second\' WHERE id=$1',[sessionId]);await staff.getByRole('button',{name:'Đăng nhập',exact:true}).waitFor({timeout:20000});assert.equal(await pc.evaluate(async()=>(await fetch('/api/v1/me')).status),200);pass('only this TEST STAFF session expired; OWNER remains valid');
 stage='history';const ids=new Set(original.map(r=>r.id));assert.deepEqual((await pool.query('SELECT * FROM stock_movements ORDER BY id')).rows.filter(r=>ids.has(r.id)),original);pass('pre-existing ledger unchanged; business menu not imported');report.status='PASS';
}catch(error){report.status='FAIL';report.failure={stage,code:error.code||'ASSERTION_OR_AUTOMATION_FAILURE'};console.log('FAIL',stage,report.failure.code);process.exitCode=1;}
finally{await browser?.close();await pool?.end();fs.writeFileSync(process.env.CLOUD_STABILITY_EVIDENCE||'/private/tmp/tram-cloud-stability-nov5.json',JSON.stringify(report,null,2),{mode:0o600});}
