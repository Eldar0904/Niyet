import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const asset = name => join(root, 'public', name);
for (const f of ['index.html','app.js','styles.css','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png']) await access(asset(f));
console.log('Niyet assets are ready.');
