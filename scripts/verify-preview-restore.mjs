// Read-only source; restore only into a newly created, private loopback PostgreSQL.
// Run with --env-file=.env.preview.local and PG_TOOLS_BIN pointing at PostgreSQL 18 tools.
import pg from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import net from 'node:net';
import path from 'node:path';
import { mkdtemp, chmod, writeFile, readFile } from 'node:fs/promises';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

process.umask(0o077);

const branch = 'br-bitter-butterfly-b8nl03v0';
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const source = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000 });
let target, instance, directory, stage = 'configuration';
const report = { checkedAt: new Date().toISOString(), sourceBranch: branch, sourceDatabase: 'neondb', scope: 'public', excluded: ['neon_auth', 'cluster roles'], backup: 'BLOCKED', restore: 'BLOCKED' };
const run = (binary, args, env) => new Promise((resolve, reject) => {
  const child = spawn(path.join(process.env.PG_TOOLS_BIN, binary), args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let error = ''; child.stderr.on('data', chunk => { error += chunk; });
  child.on('error', reject);
  child.on('close', async code => {
    if (code === 0) return resolve();
    await writeFile(path.join(directory, `${binary}-private-error.log`), error, { mode: 0o600 });
    reject(Object.assign(new Error('Tool failed; private diagnostic retained'), { code: `TOOL_EXIT_${code}` }));
  });
});
async function fingerprint(client, tables) {
  const result = {};
  for (const table of tables) {
    const sql = `SELECT count(*)::int AS count, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS checksum FROM (SELECT md5(to_jsonb(t)::text) h FROM public.${quote(table)} t) s`;
    result[table] = (await client.query(sql)).rows[0];
  }
  return result;
}
try {
  if (process.env.APP_ENV !== 'preview' || process.env.VERCEL_ENV === 'production' || !process.env.PG_TOOLS_BIN) throw new Error('Preview configuration required');
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname.includes('-pooler') || url.pathname !== '/neondb') throw new Error('Direct neondb connection required');
  await source.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await source.query("SET LOCAL TIME ZONE 'UTC'");
  const identity = (await source.query("SELECT current_database() db, current_setting('neon.branch_id',true) branch, current_setting('transaction_read_only') readonly")).rows[0];
  if (identity.db !== 'neondb' || identity.branch !== branch || identity.readonly !== 'on') throw new Error('Source identity rejected');
  report.identity = 'PASS';
  directory = await mkdtemp('/private/tmp/tram-preview-restore-');
  await chmod(directory, 0o700);
  const tables = (await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row => row.tablename);
  if (tables.length !== 20 || (await source.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n !== 3) throw new Error('Unexpected source schema');
  const before = await fingerprint(source, tables);
  const snapshot = (await source.query('SELECT pg_export_snapshot() snapshot')).rows[0].snapshot;
  let dump = path.join(directory, 'preview-public.dump');
  const sourceEnv = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'neondb', PGSSLMODE: 'verify-full', PGSSLROOTCERT: 'system', PGCONNECT_TIMEOUT: '20', PGOPTIONS: '-c default_transaction_read_only=on' };
  // Existing DATABASE_URL is not passed as an argument or logged.
  stage = 'backup';
  await run('pg_dump', ['--format=custom', '--schema=public', '--no-owner', '--no-privileges', `--snapshot=${snapshot}`, `--file=${dump}`], sourceEnv);
  await chmod(dump, 0o600);
  report.backup = 'PASS';
  report.backupSha256 = createHash('sha256').update(await readFile(dump)).digest('hex');
  await source.query('ROLLBACK');
  // Keep every artifact. Long-term encrypted storage/key custody is a separate
  // owner decision; neither plaintext nor keys may enter Git or CI artifacts.
  stage='encryption';
  const backupKey=randomBytes(32),nonce=randomBytes(12),aad=Buffer.from(JSON.stringify({branch,database:'neondb',scope:'public',sha256:report.backupSha256}));
  const cipher=createCipheriv('aes-256-gcm',backupKey,nonce);cipher.setAAD(aad);
  const encrypted=Buffer.concat([cipher.update(await readFile(dump)),cipher.final()]);
  const envelope={version:1,cipher:'aes-256-gcm',nonce:nonce.toString('base64'),aad:aad.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')};
  const encryptedPath=path.join(directory,'preview-public.encrypted.json'),keyPath=path.join(directory,'backup-key-private.bin');
  await writeFile(encryptedPath,JSON.stringify(envelope),{mode:0o600});await writeFile(keyPath,backupKey,{mode:0o600});
  const saved=JSON.parse(await readFile(encryptedPath,'utf8')),savedKey=await readFile(keyPath);
  const decode=(data)=>{const d=createDecipheriv('aes-256-gcm',savedKey,Buffer.from(saved.nonce,'base64'));d.setAAD(Buffer.from(saved.aad,'base64'));d.setAuthTag(Buffer.from(saved.tag,'base64'));return Buffer.concat([d.update(data),d.final()]);};
  const plain=decode(Buffer.from(saved.data,'base64'));
  if(createHash('sha256').update(plain).digest('hex')!==report.backupSha256)throw Error('Decryption checksum mismatch');
  const damaged=Buffer.from(saved.data,'base64');damaged[0]^=1;let rejected=false;try{decode(damaged);}catch{rejected=true;}if(!rejected)throw Error('Tampering accepted');
  dump=path.join(directory,'decrypted-restore-input.dump');await writeFile(dump,plain,{mode:0o600});
  report.encryption='PASS';report.tamperDetection='PASS';report.restoreInput='decrypted authenticated AES-256-GCM backup';report.keyCustody='LOCAL_ONLY: independent long-term storage and owner key custody pending';
  stage = 'isolated-target';
  const socket = net.createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const password = randomBytes(32).toString('base64url');
  const user = 'restore_operator';
  instance = new EmbeddedPostgres({ databaseDir: path.join(directory, 'postgres'), user, password, port, persistent: true, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1', '-k', directory], onLog: () => {}, onError: () => {} });
  await instance.initialise(); await instance.start();
  target = new pg.Client({ host: '127.0.0.1', port, user, password, database: 'postgres' });
  await target.connect(); await target.query('CREATE DATABASE tram_restore_test'); await target.end();
  target = new pg.Client({ host: '127.0.0.1', port, user, password, database: 'tram_restore_test' });
  await target.connect();
  if ((await target.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n !== 0) throw new Error('Restore destination not empty');
  await writeFile(path.join(directory, 'restore-access-private.json'), JSON.stringify({ host: '127.0.0.1', port, user, password, database: 'tram_restore_test', databaseDir: path.join(directory, 'postgres') }), { mode: 0o600 });
  stage = 'restore';
  // PostgreSQL creates public in every new database. Reuse that verified empty
  // schema instead of DROP/--clean; restore every application object and datum.
  const { stdout: toc } = await promisify(execFile)(path.join(process.env.PG_TOOLS_BIN, 'pg_restore'), ['--list', dump]);
  const schemaEntry = /^\d+;\s+\d+\s+\d+\s+SCHEMA - public /;
  if (toc.split('\n').filter(line => schemaEntry.test(line)).length !== 1) throw new Error('Unexpected dump schema inventory');
  const list = path.join(directory, 'restore-list-private.txt');
  await writeFile(list, toc.split('\n').filter(line => !schemaEntry.test(line)).join('\n'), { mode: 0o600 });
  await run('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', `--use-list=${list}`, `--dbname=tram_restore_test`, dump], { ...process.env, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: user, PGPASSWORD: password, PGSSLMODE: 'disable', PGSSLROOTCERT: '', PGOPTIONS: '', PGDATABASE: 'tram_restore_test' });
  await target.query("SET TIME ZONE 'UTC'");
  const after = await fingerprint(target, tables);
  report.tables = tables.map(name => ({ name, rows: before[name].count, match: before[name].count === after[name].count && before[name].checksum === after[name].checksum }));
  report.foreignKeys = (await target.query("SELECT count(*)::int total, count(*) FILTER (WHERE NOT convalidated)::int invalid FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace")).rows[0];
  // pg_restore validates restored foreign keys against every existing row.
  report.invariants = (await target.query(`SELECT
    (SELECT count(*)::int FROM ingredients i WHERE i.stock <> coalesce((SELECT sum(quantity) FROM stock_movements s WHERE s.ingredient_id=i.id),0)) stock_mismatches,
    (SELECT count(*)::int FROM orders o WHERE o.legacy IS NULL AND o.total IS DISTINCT FROM (SELECT sum(price::numeric*qty) FROM order_items i WHERE i.order_id=o.id)) order_mismatches,
    (SELECT count(*)::int FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.amount<>o.total OR (NOT p.legacy AND p.paid_at IS NULL)) payment_mismatches,
    (SELECT count(*)::int FROM (SELECT order_id,ingredient_id,kind FROM stock_movements WHERE order_id IS NOT NULL GROUP BY 1,2,3 HAVING count(*)>1) d) duplicate_stock,
    (SELECT count(*)::int FROM shifts WHERE checked_out_at IS NOT NULL AND (checked_in_at IS NULL OR checked_out_at<=checked_in_at)) invalid_shifts`)).rows[0];
  if (report.tables.some(row => !row.match) || report.foreignKeys.invalid || Object.values(report.invariants).some(Boolean)) throw new Error('Restore integrity mismatch');
  report.restore = 'PASS';
} catch (error) {
  report.failedStage = stage; report.errorCode = error.code || 'SAFETY_OR_INTEGRITY_CHECK_FAILED';
  if (stage === 'restore') report.restore = 'FAIL';
  process.exitCode = 1;
} finally {
  await source.end().catch(() => {}); await target?.end().catch(() => {});
  if (instance) await instance.stop().catch(() => {}); // persistent=true: retain database, never delete.
  if (directory) await writeFile(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...report, privateArtifacts: directory, retained: true }));
}
