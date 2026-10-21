import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createAppServer } from '../scripts/serve.mjs';
import { STORAGE_UNAVAILABLE } from '../server/storage.mjs';

test('storage failures keep individual practice available and disable account writes without exposing private settings', async t => {
  const server = createAppServer({ schoolUnavailable: STORAGE_UNAVAILABLE }).listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin)).status, 200);
  const state = await (await fetch(origin + '/api/session')).json(); assert.equal(state.enabled, false); assert.equal(state.setupNeeded, false); assert.equal(state.storageProblem, true); assert.match(state.storageMessage, /protect existing data/);
  const create = await fetch(origin + '/api/setup', { method: 'POST', body: '{}' }); assert.equal(create.status, 503); assert.equal((await create.json()).error, STORAGE_UNAVAILABLE);
});

test('deployment server serves the app, modules, health, and HEAD requests', async t => {
  const server = createAppServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="open-library"/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const script = await fetch(`${origin}/song-library.mjs`);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /text\/javascript/);
  const health = await fetch(`${origin}/healthz`);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const head = await fetch(origin, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('content-length'), page.headers.get('content-length'));
  assert.equal((await fetch(`${origin}/missing.mjs`)).status, 404);
  const upload = await fetch(`${origin}/`, { method: 'POST', body: 'not accepted' });
  assert.equal(upload.status, 405);
  assert.equal(upload.headers.get('allow'), 'GET, HEAD');
});

test('deployment server rejects malformed paths and never serves project metadata', async t => {
  const server = createAppServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = pathname => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: server.address().port, path: pathname, agent: false }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
  for (const pathname of ['/..%2fpackage.json', '/%2e%2e%5cpackage.json', '/.git/config', '/%00', '/C:%5cWindows']) assert.equal(await request(pathname), 403, pathname);
  assert.equal(await request('/%E0%A4%A'), 400);
  assert.equal(await request('/package.json'), 404);
});
