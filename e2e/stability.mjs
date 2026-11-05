import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {environment} from '../tests/helpers/environment.js';
import {seedDemo} from '../server/demo.js';import {freePort} from '../tests/helpers/postgres.js';import {serve} from '../server/http.js';
const {chromium}=await import(process.argv.find(a=>a.startsWith('--playwright='))?.slice(13)||'playwright');
const report={scope:'LOCAL HTTP + PostgreSQL + independent browsers',cases:[],errors:[]};let env,server,browser;
const check=async(name,fn)=>{await fn();report.cases.push({name,status:'PASS'});console.log('PASS',name);};
try{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;env=await environment(origin);const demo=await seedDemo(env.pool,env.accounts.owner.id);server=await serve(env.app,{port});
 browser=await chromium.launch({executablePath:process.env.POS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,chromiumSandbox:true});
 const context=await browser.newContext({viewport:{width:390,height:844}}),staffContext=await browser.newContext({viewport:{width:320,height:640}});
 const pc=await context.newPage(),staff=await staffContext.newPage();for(const p of [pc,staff])p.on('pageerror',()=>report.errors.push('JS_RUNTIME_ERROR'));
 async function login(p,role){await p.goto(origin);await p.getByLabel('Email',{exact:true}).fill(env.accounts[role].email);await p.getByLabel('Mật khẩu',{exact:true}).fill(env.accounts[role].password);await p.getByRole('button',{name:'Đăng nhập',exact:true}).click();await p.getByRole('navigation').waitFor();}
 await login(pc,'owner');await login(staff,'staff');
 const nav=async name=>{await pc.getByRole('navigation').getByRole('button',{name,exact:true}).click();};
 async function lost(path,submit,retry){
  await pc.route('**/api/v1'+path,async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed');}else await route.continue();},{times:1});
  await submit();await pc.getByRole('alert').first().waitFor();await pc.reload();
  const button=pc.getByRole('button',{name:'Thử lại thao tác chờ '+retry,exact:true});await button.waitFor();await button.waitFor({state:'visible'});
  const response=pc.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1'+path&&r.request().method()==='POST');await button.click();assert.equal((await response).status(),201);
  await button.waitFor({state:'detached'});
 }
 await check('lost product response + reload + replay creates one product',async()=>{
  await nav('Kho & Menu');await pc.getByLabel('Tên món',{exact:true}).fill('TEST stability product');await pc.getByLabel('Giá bán (đ)',{exact:true}).fill('123');
  await lost('/products',()=>pc.getByRole('button',{name:'Lưu món',exact:true}).click(),'tạo món');
  assert.equal((await env.pool.query('SELECT count(*)::int n FROM products WHERE name=$1',['TEST stability product'])).rows[0].n,1);
 });
 await check('lost stock response + reload + replay adds one movement only',async()=>{
  await nav('Kho & Menu');const form=pc.locator('form').filter({has:pc.locator('select[name=kind]')});
  await form.locator('select[name=ingredientId]').selectOption(demo.ingredient);await form.getByLabel('Lượng',{exact:true}).fill('7');await form.getByLabel('Đơn giá mỗi g/ml/cái (chỉ nhập hàng)',{exact:true}).fill('250');
  const before=Number((await env.pool.query('SELECT stock FROM ingredients WHERE id=$1',[demo.ingredient])).rows[0].stock);
  await lost('/stock',()=>form.getByRole('button',{name:'Ghi kho',exact:true}).click(),'nhập/điều chỉnh kho');
  assert.equal(Number((await env.pool.query('SELECT stock FROM ingredients WHERE id=$1',[demo.ingredient])).rows[0].stock),before+7);
 });
 await check('lost expense response + reload + replay creates one expense',async()=>{
  await nav('Chi phí');await pc.getByLabel('Khoản mục',{exact:true}).fill('TEST stability expense');await pc.getByLabel('Số tiền (đ)',{exact:true}).fill('7');
  await lost('/expenses',()=>pc.getByRole('button',{name:'Lưu chi phí',exact:true}).click(),'ghi chi phí');
  assert.equal((await env.pool.query('SELECT count(*)::int n FROM expenses WHERE category=$1',['TEST stability expense'])).rows[0].n,1);
 });
 await check('confirmed mutation remains successful if subsequent refresh fails',async()=>{
  await nav('Kho & Menu');await pc.getByLabel('Tên món',{exact:true}).fill('TEST refresh failure');await pc.getByLabel('Giá bán (đ)',{exact:true}).fill('10');
  await pc.route('**/api/v1/products',route=>route.request().method()==='GET'?route.abort('failed'):route.continue());
  await pc.getByRole('button',{name:'Lưu món',exact:true}).click();await pc.getByText('Server đã xác nhận lưu.',{exact:true}).waitFor();
  assert.equal(await pc.getByLabel('Tên món',{exact:true}).inputValue(),'');
  assert.equal(await pc.getByRole('region',{name:'Thao tác chờ xác nhận'}).count(),0);
  assert.equal((await env.pool.query('SELECT count(*)::int n FROM products WHERE name=$1',['TEST refresh failure'])).rows[0].n,1);
  await pc.unroute('**/api/v1/products');
 });
 await check('expired STAFF session returns to login, OWNER independent session survives',async()=>{
  await env.pool.query('UPDATE session SET "expiresAt"=now()-interval \'1 second\' WHERE "userId"=$1',[env.accounts.staff.id]);
  await staff.getByRole('button',{name:'Đăng nhập',exact:true}).waitFor({timeout:15000});
  assert.equal((await pc.evaluate(async()=> (await fetch('/api/v1/me')).status)),200);
 });
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.message.slice(0,500);for(const [i,c]of (browser?.contexts()||[]).entries())for(const p of c.pages())await p.screenshot({path:`/private/tmp/tram-stability-failure-${i}.png`,fullPage:true}).catch(()=>{});process.exitCode=1;console.log('FAIL',report.failure);}
finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await env?.close();await fs.writeFile(process.env.STABILITY_EVIDENCE_FILE||'/private/tmp/tram-stability-local.json',JSON.stringify(report,null,2));}
