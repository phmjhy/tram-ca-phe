// No DATABASE_URL/env credentials accepted. New persistent loopback DB per run.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, chmod } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { dryRun, apiPlan } from './menu-dry-run.mjs';
import { migrate } from '../server/migrate.js';
import { createAuth } from '../server/auth.js';
import { createApp } from '../server/app.js';
import { businessDate } from '../src/domain.js';
import {inspectLocalPlan,applyLocalPlan} from './menu-local-import.mjs';

process.umask(0o077);
const scaled = (value, digits=3) => {
  const [whole, fraction=''] = String(value).split('.');
  assert.ok(fraction.length <= digits || /^0*$/.test(fraction.slice(digits)));
  return BigInt(whole + fraction.slice(0,digits).padEnd(digits,'0'));
};
let instance, pool, directory;
const report = { date: null, scope: 'LOCAL_ONLY', cloud: 'NOT_RUN', cases: [], products: [] };
const check = (name, fn) => Promise.resolve().then(fn).then(() => report.cases.push({ name, status: 'PASS' }));
try {
  if (process.argv.length !== 3) throw new Error('Supply private source JSON only');
  const source = JSON.parse(await readFile(process.argv[2],'utf8'));report.date=source.readDate;
  const result = dryRun(source,{ownerApproved:true}), plan=apiPlan(result);
  assert.ok(plan.products.length>0);
  directory=await mkdtemp('/private/tmp/tram-menu-local-'); await chmod(directory,0o700);
  await writeFile(path.join(directory,'api-plan-private.json'),JSON.stringify(plan,null,2),{mode:0o600});
  const socket=net.createServer(); await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
  const port=socket.address().port; await new Promise(resolve=>socket.close(resolve));
  const user='menu_test', password=randomBytes(32).toString('base64url');
  instance=new EmbeddedPostgres({databaseDir:path.join(directory,'postgres'),user,password,port,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1','-k',directory],onLog:()=>{},onError:()=>{}});
  await instance.initialise(); await instance.start();
  pool=new pg.Pool({host:'127.0.0.1',port,user,password,database:'postgres',max:8});
  await writeFile(path.join(directory,'local-access-private.json'),JSON.stringify({host:'127.0.0.1',port,user,password,database:'postgres'}),{mode:0o600});
  await migrate(pool,{target:'test'});
  const origin='http://127.0.0.1:4176', config={origin,secret:randomBytes(48).toString('base64url')};
  const provision=createAuth(pool,config,{provisioning:true});
  const credentials={};
  for(const role of ['owner','staff']) {
    const email=`menu-${role}@example.test`, password=randomBytes(24).toString('base64url');
    const created=await provision.api.signUpEmail({body:{email,password,name:`TEST ${role}`}});
    await pool.query('INSERT INTO user_access(user_id,role) VALUES($1,$2)',[created.user.id,role]);
    credentials[role]={email,password};
  }
  const app=createApp({pool,auth:createAuth(pool,config),origin,build:'LOCAL_MENU_TEST'});
  async function call(route,{method='GET',body,cookie,key=randomUUID(),status=200}={}) {
    const response=await app(new Request(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json','X-Tram-Request':'1','Idempotency-Key':key,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
    const data=await response.json(); assert.equal(response.status,status,`${route}: expected ${status}, got ${response.status}`);
    return {data,response};
  }
  const cookies={};
  await check('independent OWNER/STAFF local logins',async()=>{
    for(const role of ['owner','staff']) { const r=await call('/api/auth/sign-in/email',{method:'POST',body:credentials[role]});cookies[role]=r.response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '); }
    assert.notEqual(cookies.owner,cookies.staff);
  });
  const api=(route,options={})=>call('/api/v1'+route,{cookie:cookies.owner,...options});
  const ids=new Map(), productIds=new Map(), needed=new Map();
  await check('target preflight before writing menu',async()=>assert.equal((await inspectLocalPlan(pool,plan)).conflicts.length,0));
  for(const product of plan.products) for(const line of product.recipe) needed.set(line.ingredientKey,(needed.get(line.ingredientKey)||0)+Number(line.quantity));
  await check('create normalized ingredients, purchase replay once, STAFF forbidden',async()=>{
    for(const ingredient of plan.ingredients) {
      const fields=ingredient.createFields;
      const id=(await api('/ingredients',{method:'POST',status:201,body:{...fields,opening:'0',minimum:'0'}})).data.id;ids.set(ingredient.key,id);
      // Synthetic local quantity only: enough for three copies of each recipe.
      const purchase={ingredientId:id,kind:'purchase',quantity:String(needed.get(ingredient.key)*3),unitCost:fields.unitCost,date:businessDate(),reason:'LOCAL TEST quantities, not real stock',supplier:'TEST'};
      const key=randomUUID();
      const first=await api('/stock',{method:'POST',status:201,body:purchase,key});
      const second=await api('/stock',{method:'POST',status:201,body:purchase,key});assert.equal(first.data.id,second.data.id);
      assert.equal((await pool.query('SELECT count(*)::int n FROM stock_movements WHERE ingredient_id=$1',[id])).rows[0].n,1);
    }
    await api('/ingredients',{method:'POST',cookie:cookies.staff,body:{},status:403});
    await api('/stock',{method:'POST',cookie:cookies.staff,body:{},status:403});
  });
  await check('create only READY products and recipes using actual API versions',async()=>{
    for(const product of plan.products) {
      const created=(await api('/products',{method:'POST',status:201,body:product.create})).data;
      await api(`/products/${created.id}/recipe`,{method:'PATCH',body:{version:1,items:product.recipe.map(line=>({ingredientId:ids.get(line.ingredientKey),quantity:line.quantity}))}});
      productIds.set(product.create.name,created.id);
    }
    assert.equal((await pool.query('SELECT count(*)::int n FROM products')).rows[0].n,plan.products.length);
  });
  await check('re-import twice skips existing identical names/recipes; no duplicate data or stock reset',async()=>{
    const actor={id:(await pool.query('SELECT id FROM "user" WHERE email=$1',[credentials.owner.email])).rows[0].id,role:'owner'};
    const before=(await pool.query("SELECT 'p' kind,count(*)::int n FROM products UNION ALL SELECT 'i',count(*)::int FROM ingredients UNION ALL SELECT 'm',count(*)::int FROM stock_movements UNION ALL SELECT 'r',count(*)::int FROM recipes ORDER BY 1")).rows;
    for(let i=0;i<2;i++)await applyLocalPlan(pool,plan,actor,{});
    assert.deepEqual((await pool.query("SELECT 'p' kind,count(*)::int n FROM products UNION ALL SELECT 'i',count(*)::int FROM ingredients UNION ALL SELECT 'm',count(*)::int FROM stock_movements UNION ALL SELECT 'r',count(*)::int FROM recipes ORDER BY 1")).rows,before);
  });
  const stock=async()=> (await pool.query('SELECT id,stock::text FROM ingredients ORDER BY id')).rows;
  let sausageId,firstOrder;
  for(const product of plan.products) {
    const id=productIds.get(product.create.name), before=await stock();
    const key=randomUUID(), body={items:[{id,qty:1,version:2}],paid:false};
    const responses=await Promise.all(Array.from({length:3},()=>api('/orders',{method:'POST',cookie:cookies.staff,body,key,status:201})));
    assert.equal(new Set(responses.map(r=>r.data.id)).size,1);
    const orderId=responses[0].data.id, after=await stock();
    firstOrder ||= orderId;
    const quantities=new Map(product.recipe.map(line=>[ids.get(line.ingredientKey),scaled(line.quantity)]));
    for(const old of before) assert.equal(scaled(old.stock)-scaled(after.find(row=>row.id===old.id).stock),quantities.get(old.id)||0n);
    const cost=(await pool.query("SELECT sum(-quantity*unit_cost)::text cost FROM stock_movements WHERE order_id=$1 AND kind='consumption'",[orderId])).rows[0].cost;
    const expected=product.recipe.reduce((sum,line)=>sum+scaled(line.quantity)*scaled(plan.ingredients.find(i=>i.key===line.ingredientKey).createFields.unitCost),0n);
    assert.equal(scaled(cost,6),expected);
    assert.equal((await pool.query('SELECT total::text FROM orders WHERE id=$1',[orderId])).rows[0].total,String(product.create.price));
    await Promise.all([cookies.owner,cookies.staff].map(cookie=>api(`/orders/${orderId}/payment`,{method:'POST',cookie,body:{}})));
    assert.deepEqual(await stock(),after);
    assert.equal((await pool.query('SELECT count(*)::int n FROM payments WHERE order_id=$1 AND paid_at IS NOT NULL',[orderId])).rows[0].n,1);
    report.products.push({name:product.create.name,sale:'PASS',stockOnce:'PASS',cogs:'PASS',paymentNoStockChange:'PASS'});
    if(product.create.name.toLocaleLowerCase('vi')==='xúc xích s2') {sausageId=id; assert.equal(expected,2600n*1000000n);assert.equal(product.create.price,5000);}
  }
  report.cases.push({name:'all READY recipes: sale replay, exact stock, decimal COGS, payment',status:'PASS'});
  await check('paid cancellation restores original consumption once across two keys',async()=>{
    const before=await stock(),used=(await pool.query("SELECT ingredient_id,quantity::text FROM stock_movements WHERE order_id=$1 AND kind='consumption'",[firstOrder])).rows;
    await Promise.all([1,2].map(()=>api(`/orders/${firstOrder}/cancel`,{method:'POST',body:{reason:'LOCAL TEST reconciliation'}})));
    const after=await stock();for(const old of before){const consumed=used.find(row=>row.ingredient_id===old.id);assert.equal(scaled(after.find(row=>row.id===old.id).stock)-scaled(old.stock),consumed?-scaled(consumed.quantity):0n);}
    assert.equal((await pool.query("SELECT count(*)::int n FROM stock_movements WHERE order_id=$1 AND kind='return'",[firstOrder])).rows[0].n,used.length);
  });
  await check('historical COGS preserved after ingredient price change; future COGS updated',async()=>{
    assert.ok(sausageId);const ingredientId=ids.get(plan.products.find(p=>p.create.name.toLowerCase()==='xúc xích s2').recipe[0].ingredientKey);
    const old=(await pool.query('SELECT name,minimum,version FROM ingredients WHERE id=$1',[ingredientId])).rows[0];
    const before=await stock(),oldLedger=(await pool.query("SELECT quantity::text,unit_cost::text FROM stock_movements WHERE kind='consumption' ORDER BY id")).rows;
    await api(`/ingredients/${ingredientId}`,{method:'PATCH',body:{name:old.name,minimum:old.minimum,version:old.version,unitCost:'1301'}});
    assert.deepEqual(await stock(),before);
    assert.deepEqual((await pool.query("SELECT quantity::text,unit_cost::text FROM stock_movements WHERE kind='consumption' ORDER BY id")).rows,oldLedger);
    const id=(await api('/orders',{method:'POST',cookie:cookies.staff,status:201,body:{items:[{id:sausageId,qty:1,version:2}],paid:false}})).data.id;
    assert.equal(scaled((await pool.query("SELECT sum(-quantity*unit_cost)::text cost FROM stock_movements WHERE order_id=$1",[id])).rows[0].cost,6),2602n*1000000n);
  });
  await check('insufficient stock rolls back; dashboard and ledger reconcile',async()=>{
    const before=await stock(),count=(await pool.query('SELECT count(*)::int n FROM orders')).rows[0].n;
    await api('/orders',{method:'POST',cookie:cookies.staff,status:409,body:{items:[{id:sausageId,qty:999,version:2}],paid:false}});
    assert.deepEqual(await stock(),before);assert.equal((await pool.query('SELECT count(*)::int n FROM orders')).rows[0].n,count);
    assert.equal((await pool.query('SELECT count(*)::int n FROM ingredients i WHERE stock<>(SELECT sum(quantity) FROM stock_movements s WHERE s.ingredient_id=i.id)')).rows[0].n,0);
    const dashboard=(await api(`/dashboard?from=${businessDate()}&to=${businessDate()}`)).data;
    assert.equal(BigInt(dashboard.sales),BigInt(dashboard.paid)+BigInt(dashboard.unpaid));
    const sum=(await pool.query("SELECT sum(-s.quantity*s.unit_cost)::text cost FROM stock_movements s WHERE kind='consumption' AND NOT EXISTS(SELECT 1 FROM cancellations c WHERE c.order_id=s.order_id)")).rows[0].cost;
    assert.equal(scaled(dashboard.cogs,6),scaled(sum,6));assert.equal(dashboard.count,plan.products.length);
  });
  report.status='PASS';report.sourceSha256=result.sourceSha256;report.summary=result.summary;
} catch(error) {report.status='FAIL';report.errorCode=error.code||'ASSERTION_OR_SETUP_FAILED';process.exitCode=1;}
finally {
  await pool?.end().catch(()=>{}); await instance?.stop().catch(()=>{});
  if(directory) await writeFile(path.join(directory,'verification.json'),JSON.stringify(report,null,2),{mode:0o600});
  process.exitCode=report.status==='PASS'?0:1;
  console.log(JSON.stringify({...report,privateDirectory:directory,retained:true}));
}
