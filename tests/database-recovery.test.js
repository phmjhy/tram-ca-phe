import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
import {startTestDatabase} from './helpers/postgres.js';import {createManagedPool} from '../server/database.js';
test('real PostgreSQL idle backend termination is handled and next query reconnects',async()=>{
 const db=await startTestDatabase(),events=[],pool=createManagedPool({...db.pool.options,password:db.pool.options.password,max:2},event=>events.push(event));
 try{
  const client=await pool.connect(),pid=(await client.query('SELECT pg_backend_pid() pid')).rows[0].pid;client.release();
  const event=once(pool,'error');await db.pool.query('SELECT pg_terminate_backend($1)',[pid]);await event;
  assert.equal(events.length,1);assert.equal(events[0].code,'57P01');assert.equal((await pool.query('SELECT 1 n')).rows[0].n,1);
 }finally{await pool.end();await db.close();}
});
test('connection errors log code only, never credentials or arbitrary error text',async()=>{
 const events=[],pool=createManagedPool({},event=>events.push(event));
 pool.emit('error',Object.assign(new Error('postgresql://private:secret@db'),{code:'postgresql://private:secret@db'}));
 assert.deepEqual(events,[{event:'database_idle_connection_error',code:'DATABASE_CONNECTION_ERROR'}]);await pool.end();
});
