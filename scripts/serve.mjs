import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClassroomApi, ClassroomStore } from '../server/classroom.mjs';
import { prepareSchoolStorage, sealSchoolStorage, STORAGE_UNAVAILABLE } from '../server/storage.mjs';
import { BandSessions } from '../server/band-sessions.mjs';

const publicRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

export function createAppServer({ school = null, schoolUnavailable = '' } = {}) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    // Public application assets are revalidated; school APIs and music are private.
    res.setHeader('Cache-Control', 'no-cache');
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    let pathname;
    let url;
    try { url = new URL(req.url, 'http://localhost'); pathname = decodeURIComponent(url.pathname); }
    catch { send(400, 'Invalid URL'); return; }
    if (pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) { send(200, '{"status":"ok"}', 'application/json'); return; }
    if (/[\\\0:]/.test(pathname) || pathname.split('/').some(part => part.startsWith('.'))) { send(403, 'Forbidden'); return; }
    if (url.pathname.startsWith('/api/')) {
      if (school) { await school.handle(req, res, url); return; }
      res.setHeader('Cache-Control', 'private, no-store');
      if (url.pathname === '/api/session' && req.method === 'GET') send(200, JSON.stringify({ enabled: false, user: null, setupNeeded: false, storageProblem: Boolean(schoolUnavailable), storageMessage: schoolUnavailable }), 'application/json');
      else send(503, JSON.stringify({ error: schoolUnavailable || 'School accounts need persistent storage configured on this server.' }), 'application/json');
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD'); send(405, 'Method not allowed'); return;
    }
    const file = path.resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(publicRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { send(403, 'Forbidden'); return; }
    try { send(200, await readFile(file), contentTypes[path.extname(file)] || 'application/octet-stream'); }
    catch (error) { const missing = ['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code); send(missing ? 404 : 500, missing ? 'Not found' : 'Unable to read file'); }
  });
  if (school) { server.bandSessions = new BandSessions(school); server.bandSessions.attach(server); }
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const host = process.argv.includes('--local') ? '127.0.0.1' : '0.0.0.0';
  const local = process.argv.includes('--local');
  const dataDir = process.env.GROOVE_DATA_DIR || (local ? fileURLToPath(new URL('../.groove-data/', import.meta.url)) : null);
  const publicOrigin = process.env.GROOVE_PUBLIC_ORIGIN || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);
  if (dataDir && !local && (!publicOrigin || !publicOrigin.startsWith('https://'))) throw new Error('Set GROOVE_PUBLIC_ORIGIN to the HTTPS address of your school app.');
  if (dataDir && !local && (!process.env.GROOVE_SETUP_TOKEN || process.env.GROOVE_SETUP_TOKEN.length < 24)) throw new Error('Set GROOVE_SETUP_TOKEN to a private setup key of at least 24 characters.');
  const storageMB = Number(process.env.GROOVE_STORAGE_MB || 1024);
  if (!Number.isInteger(storageMB) || storageMB < 128 || storageMB > 102400) throw new Error('GROOVE_STORAGE_MB must be between 128 and 102400.');
  let store = null, school = null, schoolUnavailable = '';
  try {
    if (dataDir) {
      const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
      const prepared = await prepareSchoolStorage({ directory: dataDir, local, version });
      store = await ClassroomStore.open(dataDir, { storageLimit: storageMB * 1024 * 1024 });
      const storage = await sealSchoolStorage(store, prepared);
      school = new ClassroomApi(store, { localSetup: local, secureCookies: !local, setupToken: process.env.GROOVE_SETUP_TOKEN, publicOrigin, storage });
      console.log(`School storage checked: ${storage.volumeVerified ? 'Railway volume' : local ? 'local development' : 'configured directory'}; ${storage.snapshot ? 'database recovery copy ready' : 'initial school setup'}.`);
    }
  } catch (error) {
    store?.close(); store = null; schoolUnavailable = STORAGE_UNAVAILABLE;
    console.error(`SCHOOL STORAGE PROTECTION: ${error.message}`);
  }
  const server = createAppServer({ school, schoolUnavailable });
  server.listen(port, host, () => console.log(`Groove Lab listening on ${host}:${port}\nLocal: http://localhost:${port}/`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.bandSessions?.close();
    server.close(() => { store?.close(); process.exitCode = 0; });
    setTimeout(() => { server.closeAllConnections(); }, 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
