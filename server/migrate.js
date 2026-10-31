import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function migrate(pool, { target }={}) {
 if(!['test','development','preview'].includes(target))throw new Error('Migration tự động chỉ được chạy test/development/preview. Production cần runbook backup và phê duyệt riêng.');
 const db=await pool.connect();
 try{
  await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtextextended('tram-schema-migration',0))");
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
  for(const file of (await fs.readdir(new URL('../migrations/',import.meta.url))).filter(p=>p.endsWith('.sql')).sort()){
   const sql=await fs.readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
   const old=(await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[file])).rows[0];if(old){if(old.checksum!==checksum)throw new Error('Migration checksum mismatch');continue;}
   await db.query(sql);await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[file,checksum]);
  }await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
