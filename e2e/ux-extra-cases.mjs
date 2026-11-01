import assert from 'node:assert/strict';
const micro=value=>{const s=String(value),negative=s.startsWith('-'),[whole,fraction='']=s.replace(/^-/, '').split('.');assert.ok(fraction.length<=6);const n=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));return negative?-n:n;};
export async function extraCases({pc,mobile,api,pool,productId,ingId,run,pass,resume=false}){
 if(!resume){
 const products=(await api(pc,'/products')).body;
 let p=products.find(p=>p.id===productId);assert.ok(p);
 // Dedicated TEST product has no historical orders; caller verifies this before cloud use.
 assert.equal((await api(pc,'/products/'+p.id,'PATCH',{name:p.name,price:p.price,active:false,version:p.version})).status,200);
 let current=(await api(mobile,'/products')).body.find(x=>x.id===p.id);assert.equal(current.active,false);
 const n=(await pool.query('SELECT count(*)::int n FROM orders')).rows[0].n;
 assert.equal((await api(mobile,'/orders','POST',{items:[{id:p.id,qty:1,version:current.version}],paid:false})).status,409);
 assert.equal((await pool.query('SELECT count(*)::int n FROM orders')).rows[0].n,n);
 assert.equal((await api(pc,'/products/'+p.id,'PATCH',{name:p.name,price:2000,aliases:'TEST extra '+run,active:true,version:current.version})).status,200);
 current=(await api(pc,'/products')).body.find(x=>x.id===p.id);
 assert.equal((await api(pc,'/products/'+p.id+'/recipe','PATCH',{version:current.version,items:[{ingredientId:ingId,quantity:'2'}]})).status,200);
 assert.equal((await pool.query('SELECT count(*)::int n FROM recipes WHERE product_id=$1',[p.id])).rows[0].n,1);
 pass('TEST menu edit/deactivate/reactivate; inactive sale rollback; recipe quantity update without duplicates');
 const ingredient=await api(pc,'/ingredients','POST',{name:'TEST UX extra ml '+run,unit:'ml',opening:'0',minimum:'1.5',unitCost:'0.125'});assert.equal(ingredient.status,201);
 const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}),id=ingredient.body.id,key=crypto.randomUUID();const purchase={ingredientId:id,kind:'purchase',quantity:'5.5',unitCost:'2.125',date:day,reason:'TEST purchase',supplier:'TEST'};
 assert.equal((await api(pc,'/stock','POST',purchase,key)).status,201);assert.equal((await api(pc,'/stock','POST',purchase,key)).status,201);
 assert.equal((await api(pc,'/stock','POST',{...purchase,kind:'adjustment',quantity:'-2',reason:'TEST shrinkage'})).status,201);
 assert.equal((await api(pc,'/stock','POST',{...purchase,kind:'adjustment',quantity:'-999',reason:'TEST reject negative stock'})).status,409);
 const stock=(await pool.query('SELECT stock::text FROM ingredients WHERE id=$1',[id])).rows[0];assert.equal(stock.stock,'3.500');assert.equal((await pool.query('SELECT count(*)::int n FROM stock_movements WHERE ingredient_id=$1',[id])).rows[0].n,2);
 pass('TEST ml ingredient creation; purchase replay once; adjustment; negative stock blocked',{stock:'3.500'});
 }
 const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
 const response=await api(pc,'/dashboard');console.log(JSON.stringify({dashboardStatus:response.status,contentType:response.contentType}));assert.equal(response.status,200);assert.notEqual(response.body.code,'NON_JSON_RESPONSE');const before=response.body;
 let expense={date:day,category:'TEST UX expense '+run,amount:7,note:'TEST only'},expenseKey=crypto.randomUUID();
 if(resume){const row=(await pool.query("SELECT e.category,e.business_date::text AS day,e.amount,e.note,i.key FROM expenses e JOIN idempotency i ON i.resource_id=e.id AND i.operation='expense' WHERE e.id=$1 AND e.category LIKE 'TEST UX expense %'",[process.env.UX_RESUME_EXPENSE_ID])).rows[0];assert.ok(row);expense={date:row.day,category:row.category,amount:Number(row.amount),note:row.note};expenseKey=row.key;}
 const first=await api(pc,'/expenses','POST',expense,expenseKey);console.log(JSON.stringify({expensePostStatus:first.status,code:first.body?.code}));assert.equal(first.status,201);
 assert.equal((await api(pc,'/expenses','POST',expense,expenseKey)).status,201);
 const dr=await api(pc,'/dashboard');console.log(JSON.stringify({dashboardAfterStatus:dr.status,code:dr.body?.code}));assert.equal(dr.status,200);const dashboard=dr.body;
 assert.equal(BigInt(dashboard.sales),BigInt(dashboard.paid)+BigInt(dashboard.unpaid));assert.equal(BigInt(dashboard.expenses),BigInt(before.expenses)+(resume?0n:7n));assert.equal(BigInt(dashboard.received),BigInt(before.received));assert.equal(micro(dashboard.result),micro(dashboard.sales)-micro(dashboard.cogs)-micro(dashboard.expenses));
 const er=await api(pc,'/expenses');console.log(JSON.stringify({expensesGetStatus:er.status,code:er.body?.code,contentType:er.contentType}));assert.equal(er.status,200);assert.ok(er.body.some(e=>e.category===expense.category));assert.equal((await api(mobile,'/expenses')).status,403);
 pass('Dashboard sales/debt/receipts/COGS/result and TEST expense idempotency; STAFF403');
 const own=(await api(mobile,'/me')).body;
 const start=day+'T20:00:00+07:00',end=day+'T21:00:00+07:00';
 const existing=(await api(mobile,`/shifts?from=${day}&to=${day}`)).body;
 // Only create in a free interval; no modification to pre-existing staff schedules.
 if(existing.some(s=>new Date(s.starts_at)<new Date(end)&&new Date(s.ends_at)>new Date(start)))throw Object.assign(Error(),{code:'TEST_SHIFT_INTERVAL_BUSY'});
 const shift=await api(mobile,'/shifts','POST',{startsAt:start,endsAt:end});assert.equal(shift.status,201);
 assert.equal((await api(mobile,`/shifts/${shift.body.id}/attendance`,'POST',{action:'in'})).status,200);assert.equal((await api(mobile,`/shifts/${shift.body.id}/attendance`,'POST',{action:'out'})).status,200);
 const s=(await api(pc,`/shifts?from=${day}&to=${day}`)).body.find(s=>s.id===shift.body.id);assert.equal(s.user_id,own.id);
 const change={checkedInAt:start,checkedOutAt:end,version:s.version,reason:'TEST owner correction'};
 assert.equal((await api(mobile,'/shifts/'+s.id,'PATCH',change)).status,403);
 assert.equal((await api(pc,'/shifts/'+s.id,'PATCH',{...change,reason:''})).status,422);
 assert.equal((await api(pc,'/shifts/'+s.id,'PATCH',change)).status,200);
 const corrected=(await api(pc,`/shifts?from=${day}&to=${day}`)).body.find(x=>x.id===s.id);assert.equal(Number(corrected.hours),1);
 assert.equal((await pool.query("SELECT count(*)::int n FROM audit_logs WHERE entity_id=$1 AND action='shift.correct'",[s.id])).rows[0].n,1);
 pass('New TEST shift correction owner-only; reason required; hours and audit verified');
}
