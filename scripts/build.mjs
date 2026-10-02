import { access } from 'node:fs/promises';
for (const f of ['index.html','app.js','styles.css','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png']) await access(new URL('../public/'+f,import.meta.url));
console.log('Niyet static assets ready. API runs as a Vercel function.');
