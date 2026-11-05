// Generate reviewed SQL only against a disposable, fresh PostgreSQL instance.
import { startTestDatabase } from '../tests/helpers/postgres.js';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../server/auth.js';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
const test=await startTestDatabase();
try {
 const auth=createAuth(test.pool,{origin:'http://127.0.0.1:4176',secret:randomBytes(40).toString('base64url')});
 const migration=await getMigrations(auth.options);
 const sql=await migration.compileMigrations();
 await fs.writeFile(new URL('../migrations/000_auth.sql',import.meta.url),'-- Better Auth 1.7.12 generated on empty, disposable test PostgreSQL.\n'+sql+'\n');
 console.log('Auth SQL generated on disposable PostgreSQL.');
}finally{await test.close();}
