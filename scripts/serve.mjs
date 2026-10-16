import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

export function createAppServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Revalidate modules together after a deploy; imported songs never reach this server.
    res.setHeader('Cache-Control', 'no-cache');
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD'); send(405, 'Method not allowed'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { send(400, 'Invalid URL'); return; }
    if (pathname === '/healthz') { send(200, '{"status":"ok"}', 'application/json'); return; }
    if (/[\\\0:]/.test(pathname) || pathname.split('/').some(part => part.startsWith('.'))) { send(403, 'Forbidden'); return; }
    const file = path.resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(publicRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { send(403, 'Forbidden'); return; }
    try { send(200, await readFile(file), contentTypes[path.extname(file)] || 'application/octet-stream'); }
    catch (error) { const missing = ['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code); send(missing ? 404 : 500, missing ? 'Not found' : 'Unable to read file'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const host = process.argv.includes('--local') ? '127.0.0.1' : '0.0.0.0';
  const server = createAppServer();
  server.listen(port, host, () => console.log(`Groove Lab listening on ${host}:${port}\nLocal: http://localhost:${port}/`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => { process.exitCode = 0; });
    setTimeout(() => { server.closeAllConnections(); }, 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
