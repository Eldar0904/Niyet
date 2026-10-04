import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { initialState } from './domain.mjs';

let queue = Promise.resolve();
function dataDir() { return process.env.NIYET_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || join(process.cwd(), '.data'); }
function location() { return join(dataDir(), 'state.json'); }
async function loadLocal() {
  try { return JSON.parse(await readFile(location(), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return initialState(); }
}
async function saveLocal(state) {
  const dir = dataDir(); await mkdir(dir, { recursive: true });
  const temp = location() + '.tmp'; await writeFile(temp, JSON.stringify(state), { mode: 0o600 }); await rename(temp, location());
}
export function update(mutator) {
  const operation = queue.then(async () => { const state = await loadLocal(); const result = await mutator(state); await saveLocal(state); return result; });
  queue = operation.catch(() => {}); return operation;
}
