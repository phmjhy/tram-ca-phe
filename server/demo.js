import {randomUUID} from 'node:crypto';
// Only synthetic DEMO data; explicitly opt in on an isolated non-production DB.
export async function seedDemo(pool,actor){
 const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtextextended('tram-demo-seed',0))");
 if((await db.query('SELECT 1 FROM products LIMIT 1')).rowCount||(await db.query('SELECT 1 FROM ingredients LIMIT 1')).rowCount)throw new Error('DEMO seed requires an empty business database.');
 const product=randomUUID(),ingredient=randomUUID();
 await db.query("INSERT INTO ingredients(id,name,unit,minimum,stock,unit_cost) VALUES($1,'DEMO Cà phê hạt','g',100,1000,200)",[ingredient]);
 await db.query("INSERT INTO stock_movements(id,ingredient_id,kind,quantity,unit_cost,reason,business_date,actor_id) VALUES($1,$2,'opening',1000,200,'DEMO only',(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,$3)",[randomUUID(),ingredient,actor]);
 await db.query("INSERT INTO products(id,name,category,price,aliases) VALUES($1,'Cà phê','Menu',15000,'cafe coffee ca phe')",[product]);
 await db.query('INSERT INTO recipes(product_id,ingredient_id,quantity) VALUES($1,$2,20)',[product,ingredient]);
 await db.query('COMMIT');return {product,ingredient};}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
