import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { initialState } from './domain.mjs';

let sql, initialized, queue = Promise.resolve();
function location() { return join(process.env.NIYET_DATA_DIR || join(process.cwd(), '.data'), 'state.json'); }
async function postgres() {
  if (!sql) { const { default: postgres } = await import('postgres'); sql = postgres(process.env.DATABASE_URL, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false }); }
  if (!initialized) initialized = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS niyet_state (id INTEGER PRIMARY KEY, revision BIGINT NOT NULL DEFAULT 0, data JSONB NOT NULL)`;
    await sql`INSERT INTO niyet_state (id, data) VALUES (1, ${sql.json(initialState())}) ON CONFLICT (id) DO NOTHING`;
  })().catch(error => { initialized = null; throw error; });
  await initialized; return sql;
}
async function loadLocal() {
  try { return JSON.parse(await readFile(location(), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return initialState(); }
}
async function saveLocal(state) {
  const dir = process.env.NIYET_DATA_DIR || join(process.cwd(), '.data'); await mkdir(dir, { recursive: true });
  const temp = location() + '.tmp'; await writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await rename(temp, location());
}
export function update(mutator) {
  if (process.env.VERCEL && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required on Vercel.');
  if (process.env.DATABASE_URL) return (async () => {
    const db = await postgres();
    return db.begin(async transaction => {
      const [row] = await transaction`SELECT data FROM niyet_state WHERE id = 1 FOR UPDATE`;
      const result = await mutator(row.data);
      await transaction`UPDATE niyet_state SET data = ${transaction.json(row.data)}, revision = revision + 1 WHERE id = 1`;
      return result;
    });
  })();
  const operation = queue.then(async () => { const state = await loadLocal(); const result = await mutator(state); await saveLocal(state); return result; });
  queue = operation.catch(() => {}); return operation;
}
export async function closeStore() { if (sql) await sql.end(); }
