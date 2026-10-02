import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import handler from './lib/api.mjs';

const root = resolve('public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname.startsWith('/api/')) return handler(req, res);
  let path; try { path = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  if (path === '/' || path === '/admin' || path.startsWith('/g/')) path = '/index.html';
  const file = resolve(join(root, path));
  if (!file.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file); res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    res.setHeader('Cache-Control', path === '/sw.js' || path === '/index.html' ? 'no-cache' : 'public, max-age=3600'); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log('Niyet preview: http://localhost:' + (process.env.PORT || 3000)));
