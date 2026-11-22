// VELVET VAULT — serve.ts
// Tiny static file server for playtesting: serves game/ on localhost so the
// game loads exactly as a static host would serve it. No build step, no
// dependencies, standard library only.
//
//   node serve.ts [port]   (default 8095)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = parseInt(process.argv[2] || '8095', 10);
const GAME_DIR = new URL('./game/', import.meta.url).pathname;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = join(GAME_DIR, rel);
  if (!file.startsWith(GAME_DIR) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

server.listen(PORT, () => {
  console.log('VELVET VAULT at http://localhost:' + PORT + '/ (serving game/)');
});
