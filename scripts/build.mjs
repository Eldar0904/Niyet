import { access } from 'node:fs/promises';
import { build } from 'esbuild';
const root = new URL('../', import.meta.url);
await build({
  entryPoints: [new URL('public/firebase-client.src.js', root).pathname],
  bundle: true, platform: 'browser', format: 'iife', target: ['es2022'],
  outfile: new URL('public/firebase-client.js', root).pathname, minify: true
});
for (const f of ['index.html','app.js','firebase-config.js','firebase-client.js','styles.css','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png']) await access(new URL('public/'+f,root));
console.log('Niyet Firebase client and static assets are ready.');
