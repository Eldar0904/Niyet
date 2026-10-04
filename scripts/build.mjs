import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const asset = name => join(root, 'public', name);
await build({
  entryPoints: [asset('firebase-client.src.js')],
  bundle: true, platform: 'browser', format: 'iife', target: ['es2022'],
  outfile: asset('firebase-client.js'), minify: true
});
for (const f of ['index.html','app.js','firebase-config.js','firebase-client.js','styles.css','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png']) await access(asset(f));
console.log('Niyet Firebase client and static assets are ready.');
