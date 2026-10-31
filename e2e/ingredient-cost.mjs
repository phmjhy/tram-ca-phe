// Local by default. Cloud writes require explicit --preview and verified branch identity.
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {environment} from '../tests/helpers/environment.js';
import {seedDemo} from '../server/demo.js';
import {freePort} from '../tests/helpers/postgres.js';
import {serve} from '../server/http.js';
const preview=process.argv.includes('--preview');
const modulePath=process.argv.find(a=>a.startsWith('--playwright='))?.slice(13)||'playwright';
const {chromium}=await import(modulePath);
const result={scope:preview?'Neon/Vercel Preview':'Isolated native PostgreSQL/local HTTP',at:new Date().toISOString(),cases:[]};
let env,pool,server,browser,stage='setup';
function pass(name,detail={}){const c={name,status:'PASS',...detail};result.cases.push(c);console.log(JSON.stringify(c));}
try{
 let origin,accounts,ingredientId,productId;
 if(preview){
  const config=parseEnv(fs.readFileSync('.env.preview.local','utf8')),u=new URL(config.DATABASE_URL);
  origin='https://tram-ca-phe-git-feature-cafe-management-tramsac.vercel.app';
  assert.equal(config.APP_ENV,'preview');assert.equal(config.APP_ORIGIN,origin);assert.equal(u.pathname,'/neondb');assert.ok(u.hostname.endsWith('.neon.tech')&&!u.hostname.includes('-pooler'));
  pool=new pg.Pool({connectionString:config.DATABASE_URL,connectionTimeoutMillis:15000});
  const id=(await pool.query("SELECT current_database() db,current_setting('neon.branch_id',true) branch")).rows[0];assert.equal(id.db,'neondb');assert.equal(id.branch,'br-bitter-butterfly-b8nl03v0');result.database=id;
  accounts=Object.fromEntries(['owner','staff'].map(role=>{const a=parseEnv(fs.readFileSync('.env.preview-'+role+'.local','utf8'));return [role,{email:a.POS_USER_EMAIL,password:a.POS_USER_PASSWORD}];}));
  ingredientId='8a1177f8-2ac4-4981-a6de-0cdb9628b189';productId='59b8bc99-edf2-4313-a86e-39dd421b9bc5';
  const safe=(await pool.query("SELECT i.name FROM ingredients i JOIN recipes r ON r.ingredient_id=i.id JOIN products p ON p.id=r.product_id WHERE i.id=$1 AND p.id=$2 AND i.name LIKE 'TEST CLOUD %' AND p.name LIKE 'TEST CLOUD %'",[ingredientId,productId])).rows;assert.equal(safe.length,1);
 }else{
  const port=await freePort();origin=`http://127.0.0.1:${port}`;env=await environment(origin);pool=env.pool;accounts=env.accounts;const data=await seedDemo(pool,accounts.owner.id);ingredientId=data.ingredient;productId=data.product;server=await serve(env.app,{port});
 }
 async function snapshot(){return (await pool.query('SELECT id,order_id,quantity::text,unit_cost::text FROM stock_movements WHERE ingredient_id=$1 ORDER BY id',[ingredientId])).rows;}
 const history=await snapshot(),oldItems=(await pool.query('SELECT * FROM order_items ORDER BY order_id,position')).rows;
 browser=await chromium.launch({executablePath:process.env.POS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 const sessions=[];
 for(const role of ['owner','owner','staff']){
  const ctx=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Ho_Chi_Minh'});
  if(preview){const token=fs.readFileSync(process.env.PREVIEW_AUTOMATION_TOKEN_FILE,'utf8').trim();assert.ok(token);await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue({headers:{...route.request().headers(),'x-vercel-protection-bypass':token}}):route.continue());}
  const p=await ctx.newPage();await p.goto(origin);await p.getByLabel('Email',{exact:true}).fill(accounts[role].email);await p.getByLabel('Mật khẩu',{exact:true}).fill(accounts[role].password);await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();await p.getByRole('navigation').waitFor();sessions.push(p);
 }
 const [pc,other,staff]=sessions;
 async function api(p,path,method='GET',body){return p.evaluate(async({path,method,body})=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-Tram-Request':'1','Idempotency-Key':crypto.randomUUID()},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};},{path,method,body});}
 const nav=(p,name)=>p.getByRole('navigation').getByRole('button',{name,exact:true}).click();
 const initial=(await pool.query('SELECT * FROM ingredients WHERE id=$1',[ingredientId])).rows[0];
 stage='edit_UI';await nav(pc,'Kho & Menu');
 await pc.locator('details').first().waitFor();let details;for(const d of await pc.locator('details').all()){if(await d.locator('input[name=name]').inputValue()===initial.name){details=d;break;}}assert.ok(details);await details.locator('summary').click();
 stage='prefill_UI';const input=details.locator('input[name=unitCost]');assert.equal(Number(await input.inputValue()),Number(initial.unit_cost));assert.equal(await input.getAttribute('min'),'0');assert.equal(await input.getAttribute('step'),'0.001');
 await input.fill('-1');assert.equal(await input.evaluate(e=>e.validity.valid),false);await input.fill('12.345');
 const response=pc.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/ingredients/${ingredientId}`&&r.request().method()==='PATCH');await details.getByRole('button',{name:'Lưu nguyên liệu đã sửa',exact:true}).click();assert.equal((await response).status(),200);
 stage='verify_edit_UI';let current=(await pool.query('SELECT * FROM ingredients WHERE id=$1',[ingredientId])).rows[0];assert.equal(current.unit_cost,'12.345');assert.equal(current.stock,initial.stock);assert.equal(current.version,initial.version+1);assert.deepEqual(await snapshot(),history);
 pass('OWNER prefilled decimal cost edit; negative HTML validity; no stock/history change',{cost:'12.345',stock:current.stock});
 stage='mobile_UI';for(const width of [390,320]){await pc.setViewportSize({width,height:844});await input.scrollIntoViewIfNeeded();assert.ok(await input.isVisible());assert.equal(await pc.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);pass('OWNER edit form fits mobile '+width);}
 stage='authorization_validation_concurrency';const body={name:current.name,minimum:current.minimum,unitCost:'25.125',version:current.version};
 assert.equal((await api(staff,`/api/v1/ingredients/${ingredientId}`,'PATCH',body)).status,403);
 for(const unitCost of ['-1','1.0001','NaN'])assert.equal((await api(pc,`/api/v1/ingredients/${ingredientId}`,'PATCH',{...body,unitCost})).status,422);
 const statuses=await Promise.all([api(pc,`/api/v1/ingredients/${ingredientId}`,'PATCH',body),api(other,`/api/v1/ingredients/${ingredientId}`,'PATCH',body)]);assert.deepEqual(statuses.map(r=>r.status).sort(),[200,409]);assert.deepEqual(await snapshot(),history);assert.equal((await pool.query('SELECT stock FROM ingredients WHERE id=$1',[ingredientId])).rows[0].stock,initial.stock);
 pass('STAFF403; invalid costs422; two OWNER sessions CAS200/409; stock/history unchanged');
 stage='future_COGS';const products=(await api(staff,'/api/v1/products')).body,product=products.find(p=>p.id===productId);const sale=await api(staff,'/api/v1/orders','POST',{items:[{id:productId,qty:1,version:product.version,note:'TEST ingredient price future COGS'}],paid:false});assert.equal(sale.status,201);
 const consumption=(await pool.query("SELECT unit_cost::text FROM stock_movements WHERE order_id=$1 AND kind='consumption'",[sale.body.id])).rows;assert.equal(consumption.length,1);assert.equal(consumption[0].unit_cost,'25.125');
 const oldIds=history.map(m=>m.id);assert.deepEqual((await snapshot()).filter(m=>oldIds.includes(m.id)),history);assert.deepEqual((await pool.query('SELECT * FROM order_items WHERE order_id<>$1 ORDER BY order_id,position',[sale.body.id])).rows,oldItems);
 pass('New TEST sale snapshots updated COGS; all previous ledger/items unchanged',{unitCost:'25.125'});
 stage='new_product_autoselect';await pc.setViewportSize({width:1440,height:900});await pc.getByLabel('Chọn món để sửa',{exact:true}).selectOption('');const name='TEST auto recipe '+randomUUID();await pc.getByLabel('Tên món',{exact:true}).fill(name);await pc.getByLabel('Giá bán (đ)',{exact:true}).fill('12345');const created=pc.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/products'&&r.request().method()==='POST');await pc.getByRole('button',{name:'Lưu món',exact:true}).click();const saved=await created;assert.equal(saved.status(),201);const added=await saved.json();await pc.waitForFunction(id=>document.querySelector('select[aria-label="Chọn món để sửa"]')?.value===id,added.id);await pc.getByRole('heading',{name:'Công thức',exact:true}).waitFor();pass('New product auto-selected and recipe visible without manual reselection');
}catch(e){result.failure={stage,type:e.name,safeDetail:stage==='mobile_UI'?e.message.slice(0,1600):undefined,code:e.code||'REDACTED_ERROR',actual:['number','boolean'].includes(typeof e.actual)?e.actual:undefined,expected:['number','boolean'].includes(typeof e.expected)?e.expected:undefined};console.log(JSON.stringify(result.failure));process.exitCode=1;}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));if(env)await env.close();else await pool?.end();const file=process.env.INGREDIENT_EVIDENCE_FILE||'/private/tmp/tram-ingredient-cost-results.json';fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');if(result.failure)process.exitCode=1;}
