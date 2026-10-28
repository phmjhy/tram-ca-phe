import { management } from './management.js';
import { randomUUID, createHash } from 'node:crypto';
import { channels, businessDate } from '../src/domain.js';
import { HttpError, requireOwner, fields, text, price, qty, uuid, date } from './validation.js';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
async function audit(db, actor, action, id, detail={}) { await db.query('INSERT INTO audit_logs(actor_id,action,entity_id,detail) VALUES($1,$2,$3,$4)',[actor.id,action,id,JSON.stringify(detail)]); }
export async function transaction(pool, work) {
 const db=await pool.connect(); try { await db.query('BEGIN'); const result=await work(db); await db.query('COMMIT'); return result; }
 catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
export function services(pool) {
 async function listProducts() { return (await pool.query('SELECT id,name,category,price::text,active,version,aliases,preparation_note FROM products ORDER BY name,id')).rows.map(p=>({...p,price:Number(p.price)})); }
 async function listOrders(actor, { limit=100, before }={}) {
  const rows=(await pool.query(`SELECT o.*,p.paid_at,p.id AS payment_id,EXISTS(SELECT 1 FROM cancellations c WHERE c.order_id=o.id) AS reversed,
   (SELECT jsonb_agg(jsonb_build_object('id',i.product_id,'name',i.name,'price',i.price,'qty',i.qty,'note',i.note) ORDER BY i.position) FROM order_items i WHERE i.order_id=o.id) AS items
   FROM orders o LEFT JOIN payments p ON p.order_id=o.id
   WHERE ($1::timestamptz IS NULL OR o.created_at<$1) ORDER BY o.created_at DESC,o.id DESC LIMIT $2`,[before||null,limit])).rows;
  return rows.map(o=>{
   const sensitive=actor.role==='owner'||(o.created_by===actor.id && businessDate(o.created_at)===businessDate());
   return {id:o.id,storageId:o.id,code:o.code,channel:o.channel,total:Number(o.total),createdAt:o.created_at.toISOString(),paid:Boolean(o.payment_id),paidAt:o.paid_at?.toISOString()||null,
    items:o.items||[],cancelled:o.cancelled||o.reversed,appCode:o.app_code,note:sensitive?o.note:'',customer:sensitive?o.customer:'',phone:sensitive?o.phone:'',address:sensitive?o.address:'',
    ...(actor.role==='owner'&&o.legacy?{legacy:o.legacy}:{})};
  });
 }
 async function idempotent(actor, operation, key, body, work) {
  uuid(key); const digest=hash(body);
  return transaction(pool, async db=>{
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${actor.id}:${operation}:${key}`]);
   const old=(await db.query('SELECT * FROM idempotency WHERE actor_id=$1 AND operation=$2 AND key=$3',[actor.id,operation,key])).rows[0];
   if(old){if(old.request_hash!==digest)throw new HttpError(409,'Mã thao tác đã dùng cho nội dung khác.','IDEMPOTENCY_CONFLICT');return {id:old.resource_id,replayed:true};}
   const result=await work(db);
   await db.query('INSERT INTO idempotency(actor_id,operation,key,request_hash,resource_id) VALUES($1,$2,$3,$4,$5)',[actor.id,operation,key,digest,result.id]); return result;
  });
 }
 return {
  listProducts,listOrders,...management(pool,{transaction,idempotent}),
  async addProduct(actor,b) { requireOwner(actor);fields(b,['name','category','price','active','aliases','preparationNote']);const p={id:randomUUID(),name:text(b.name,120,true),category:text(b.category||'Menu',80,true),price:price(b.price),active:b.active===undefined?true:b.active};if(typeof p.active!=='boolean')throw new HttpError(422,'Trạng thái món không hợp lệ.');
   return transaction(pool,async db=>{await db.query('INSERT INTO products(id,name,category,price,active,aliases,preparation_note) VALUES($1,$2,$3,$4,$5,$6,$7)',[p.id,p.name,p.category,p.price,p.active,text(b.aliases,500),text(b.preparationNote,1000)]);await audit(db,actor,'product.create',p.id);return p;});
  },
  async updateProduct(actor,id,b) { requireOwner(actor);uuid(id);fields(b,['name','category','price','active','version','aliases','preparationNote']);if(!Number.isInteger(b.version)||b.version<1)throw new HttpError(422,'Thiếu version món.');
   return transaction(pool,async db=>{const old=(await db.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!old)throw new HttpError(404,'Không tìm thấy món.');if(old.version!==b.version)throw new HttpError(409,'Menu đã đổi. Tải lại trước khi sửa.','STALE_PRICE');
    const p={name:b.name===undefined?old.name:text(b.name,120,true),category:b.category===undefined?old.category:text(b.category||'Menu',80,true),price:b.price===undefined?Number(old.price):price(b.price),active:b.active===undefined?old.active:b.active};if(typeof p.active!=='boolean')throw new HttpError(422,'Trạng thái món không hợp lệ.');
    await db.query('UPDATE products SET name=$2,category=$3,price=$4,active=$5,version=version+1,updated_at=now(),aliases=$6,preparation_note=$7 WHERE id=$1',[id,p.name,p.category,p.price,p.active,b.aliases===undefined?old.aliases:text(b.aliases,500),b.preparationNote===undefined?old.preparation_note:text(b.preparationNote,1000)]);await audit(db,actor,'product.update',id,{oldPrice:old.price,newPrice:p.price});return {id,...p,version:b.version+1};});
  },
  async createOrder(actor,b,key) {
   fields(b,['items','paid']);
   if(!Array.isArray(b.items)||!b.items.length||b.items.length>100||typeof b.paid!=='boolean')throw new HttpError(422,'Giỏ hoặc trạng thái thanh toán không hợp lệ.');
   const lines=b.items.map(i=>{fields(i,['id','qty','version','note']);uuid(i.id);qty(i.qty);if(!Number.isInteger(i.version)||i.version<1)throw new HttpError(422,'Thiếu version giá.');return {...i,note:text(i.note,500)};});
   if(new Set(lines.map(i=>i.id)).size!==lines.length)throw new HttpError(422,'Món bị lặp trong giỏ.');
   return idempotent(actor,'create-order',key,b,async db=>{
    const products=(await db.query('SELECT * FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[lines.map(i=>i.id)])).rows;
    let total=0n;
    const items=lines.map(i=>{const p=products.find(p=>p.id===i.id);if(!p?.active)throw new HttpError(409,'Món đã ngừng bán. Cập nhật giỏ.','STALE_PRICE');if(p.version!==i.version)throw new HttpError(409,'Giá món đã đổi. Cập nhật giỏ và xác nhận lại.','STALE_PRICE');total+=BigInt(p.price)*BigInt(i.qty);return {...i,name:p.name,price:p.price};});
    if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new HttpError(422,'Tổng tiền vượt giới hạn.');
    const id=randomUUID();
    const recipes=(await db.query('SELECT * FROM recipes WHERE product_id=ANY($1::uuid[]) ORDER BY ingredient_id',[lines.map(i=>i.id)])).rows;
    if(lines.some(i=>!recipes.some(r=>r.product_id===i.id)))throw new HttpError(409,'Món chưa có công thức. Nhờ chủ quán cập nhật.','MISSING_RECIPE');
    // Numeric aggregation stays in PostgreSQL, not floating point JavaScript.
    const needs=(await db.query(`SELECT r.ingredient_id,sum(r.quantity*x.qty)::text AS needed FROM recipes r JOIN jsonb_to_recordset($1::jsonb) AS x(id uuid,qty integer) ON x.id=r.product_id GROUP BY r.ingredient_id ORDER BY r.ingredient_id`,[JSON.stringify(lines)])).rows;
    await db.query('SELECT id FROM ingredients WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[needs.map(n=>n.ingredient_id)]);
    await db.query("INSERT INTO orders(id,code,channel,total,created_by) VALUES($1,$2,'store',$3,$4)",[id,`TC-${id}`,total.toString(),actor.id]);
    for(const [position,item] of items.entries())await db.query('INSERT INTO order_items(order_id,product_id,position,name,price,qty,note) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,item.id,position,item.name,item.price,item.qty,item.note]);
    for(const n of needs){
     const stock=await db.query('UPDATE ingredients SET stock=stock-$2::numeric,version=version+1 WHERE id=$1 AND stock >= $2::numeric RETURNING unit_cost,name',[n.ingredient_id,n.needed]);
     if(!stock.rowCount)throw new HttpError(409,'Không đủ nguyên liệu. Giao dịch chưa được lưu.','INSUFFICIENT_STOCK');
     await db.query(`INSERT INTO stock_movements(id,ingredient_id,order_id,kind,quantity,unit_cost,business_date,actor_id) VALUES($1,$2,$3,'consumption',-$4::numeric,$5,$6,$7)`,[randomUUID(),n.ingredient_id,id,n.needed,stock.rows[0].unit_cost,businessDate(),actor.id]);
    }
    if(b.paid)await db.query('INSERT INTO payments(id,order_id,amount,paid_at,recorded_by) VALUES($1,$2,$3,now(),$4)',[randomUUID(),id,total.toString(),actor.id]);
    await audit(db,actor,'order.create',id);return {id};
   });
  },
  async pay(actor,id,key) { uuid(id);return idempotent(actor,'pay-order',key,{id},async db=>{
   const o=(await db.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!o)throw new HttpError(404,'Không tìm thấy đơn.');if(o.cancelled||(await db.query('SELECT 1 FROM cancellations WHERE order_id=$1',[id])).rowCount)throw new HttpError(409,'Đơn hủy cũ chỉ xem.');
   const old=(await db.query('SELECT * FROM payments WHERE order_id=$1',[id])).rows[0];if(!old){await db.query('INSERT INTO payments(id,order_id,amount,paid_at,recorded_by) VALUES($1,$2,$3,now(),$4)',[randomUUID(),id,o.total,actor.id]);await audit(db,actor,'order.pay',id);}return {id};
  });},
  async operation(actor,key) {uuid(key);return (await pool.query('SELECT resource_id AS id,operation FROM idempotency WHERE actor_id=$1 AND key=$2',[actor.id,key])).rows;},
  async dailyReport(day) {date(day);return transaction(pool,async db=>{
   await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const rows=(await db.query(`SELECT o.channel,count(*)::integer AS count,sum(o.total)::text AS sales,
    COALESCE(sum(o.total) FILTER(WHERE p.id IS NOT NULL),0)::text AS paid,COALESCE(sum(o.total) FILTER(WHERE p.id IS NULL),0)::text AS unpaid
    FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE NOT o.cancelled AND NOT EXISTS(SELECT 1 FROM cancellations c WHERE c.order_id=o.id) AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=$1::date GROUP BY o.channel`,[day])).rows;
   const extra=(await db.query(`SELECT COALESCE(sum(p.amount) FILTER(WHERE NOT o.cancelled AND NOT EXISTS(SELECT 1 FROM cancellations c WHERE c.order_id=o.id) AND (p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=$1::date),0)::text AS received,
    count(*) FILTER(WHERE NOT o.cancelled AND p.paid_at IS NULL)::integer AS unknown FROM payments p JOIN orders o ON o.id=p.order_id`,[day])).rows[0];
   const result={count:0,sales:0n,paid:0n,unpaid:0n,received:extra.received,unknownPaidAt:extra.unknown,legacyTotals:0,rows:channels.map(c=>({ ...c,...(rows.find(r=>r.channel===c.id)||{count:0,sales:'0',paid:'0',unpaid:'0'})}))};
   for(const r of rows){result.count+=r.count;for(const k of ['sales','paid','unpaid'])result[k]+=BigInt(r[k]);}for(const k of ['sales','paid','unpaid'])result[k]=result[k].toString();return result;
  });}
 };
}
