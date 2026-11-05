// Deliberately local-only. This is not a Production import entry point.
import {createHash} from 'node:crypto';
import {normalize} from './menu-dry-run.mjs';
import {services} from '../server/service.js';
const decimal=value=>{const [a,b='']=String(value).split('.');return BigInt(a+b.padEnd(3,'0'));};
const key=value=>{const h=createHash('sha256').update(value).digest('hex').slice(0,32).split('');h[12]='4';h[16]='8';const s=h.join('');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');};
async function guard(pool){
 if(!['127.0.0.1','localhost','::1'].includes(pool.options.host))throw Error('LOCAL_ONLY');
 const r=(await pool.query("SELECT current_setting('neon.branch_id',true) branch")).rows[0];
 if(r.branch)throw Error('LOCAL_ONLY');
}
export async function inspectLocalPlan(pool,plan){
 await guard(pool);const [ingredients,products,recipes]=await Promise.all([pool.query('SELECT * FROM ingredients'),pool.query('SELECT * FROM products'),pool.query('SELECT * FROM recipes')]);
 const result={ingredients:new Map(),products:new Map(),conflicts:[]};
 for(const i of plan.ingredients){const matches=ingredients.rows.filter(row=>normalize(row.name)===normalize(i.createFields.name));
  if(matches.length>1||matches.some(row=>row.unit!==i.createFields.unit||decimal(row.unit_cost)!==decimal(i.createFields.unitCost)))result.conflicts.push({kind:'ingredient',key:i.key,reason:'DUPLICATE_OR_DIFFERENT_UNIT_COST'});
  if(matches.length===1)result.ingredients.set(i.key,matches[0]);
 }
 for(const p of plan.products){const matches=products.rows.filter(row=>normalize(row.name)===normalize(p.create.name));
  if(matches.length>1||matches.some(row=>Number(row.price)!==p.create.price||!row.active))result.conflicts.push({kind:'product',key:p.key,reason:'DUPLICATE_OR_DIFFERENT_PRICE_STATE'});
  if(matches.length===1){const row=matches[0];result.products.set(p.key,row);const existing=recipes.rows.filter(r=>r.product_id===row.id);
   if(existing.length&&(existing.length!==p.recipe.length||p.recipe.some(line=>!existing.some(r=>r.ingredient_id===result.ingredients.get(line.ingredientKey)?.id&&decimal(r.quantity)===decimal(line.quantity)))))result.conflicts.push({kind:'recipe',key:p.key,reason:'DIFFERENT_RECIPE'});
  }
 }
 return result;
}
export async function applyLocalPlan(pool,plan,actor,inventory){
 await guard(pool);const lock=await pool.connect();await lock.query("SELECT pg_advisory_lock(hashtextextended('tram-menu-local-import',0))");
 try{
  const preflight=await inspectLocalPlan(pool,plan);if(preflight.conflicts.length)throw Object.assign(Error('TARGET_CONFLICT'),{conflicts:preflight.conflicts});
  for(const i of plan.ingredients)if(!preflight.ingredients.has(i.key)&&(!inventory?.[i.key]||inventory[i.key].opening===undefined||inventory[i.key].minimum===undefined))throw Error('INVENTORY_REQUIRED');
  const service=services(pool),ids=new Map();
  for(const i of plan.ingredients){const old=preflight.ingredients.get(i.key);const created=old||await service.ingredient(actor,{...i.createFields,...inventory[i.key]},key('ingredient:'+i.key));ids.set(i.key,created.id);}
  for(const p of plan.products){let row=preflight.products.get(p.key);if(!row){row=await service.addProduct(actor,p.create,key('product:'+p.key));row=(await pool.query('SELECT * FROM products WHERE id=$1',[row.id])).rows[0];}
   const existing=(await pool.query('SELECT * FROM recipes WHERE product_id=$1',[row.id])).rows;
   if(!existing.length)await service.recipe(actor,row.id,{version:row.version,items:p.recipe.map(i=>({ingredientId:ids.get(i.ingredientKey),quantity:i.quantity}))});
  }
  return {ingredients:plan.ingredients.length,products:plan.products.length};
 }finally{await lock.query("SELECT pg_advisory_unlock(hashtextextended('tram-menu-local-import',0))");lock.release();}
}
