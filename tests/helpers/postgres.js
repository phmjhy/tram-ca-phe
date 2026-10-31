import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import net from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
export async function freePort() {const s=net.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});const port=s.address().port;await new Promise(r=>s.close(r));return port;}
export async function startTestDatabase() {
 const port=await freePort();const password=randomBytes(24).toString('base64url');
 const databaseDir=await mkdtemp(path.join(tmpdir(),'tram-pg-test-'));
 const instance=new EmbeddedPostgres({databaseDir,user:'pos_test',password,port,persistent:false,authMethod:'scram-sha-256',
  postgresFlags:['-h','127.0.0.1','-k',tmpdir()],onLog:()=>{},onError:()=>{}});
 await instance.initialise();await instance.start();
 const pool=new pg.Pool({host:'127.0.0.1',port,user:'pos_test',password,database:'postgres',max:12});
 return {pool,instance,async close(){await pool.end();await instance.stop();}};
}
