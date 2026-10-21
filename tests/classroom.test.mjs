import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
import { ClassroomStore, ClassroomApi, validateSchoolRun } from '../server/classroom.mjs';
import { createAppServer } from '../scripts/serve.mjs';
import { createDemoMidi, createDemoWav } from '../dist/demo-data.mjs';
import { backupSchool } from '../scripts/backup-school.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const passphrase = 'practice together every day';
const result = () => ({ id: randomUUID(), sourceKind: 'builtin', sourceId: 'rock', title: 'Untrusted client title', hits: 6, total: 8, extras: 1, bestStreak: 4, meanMs: -10, meanAbsMs: 20, bpm: 80, endBpm: 85, tolerance: 140, focus: 'all', section: '1–2', full: false, repeats: 2, drums: [{ id: 'kick', total: 4, hits: 3, meanMs: -10, meanAbsMs: 20 }, { id: 'snare', total: 4, hits: 3, meanMs: -10, meanAbsMs: 20 }] });

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'groove-classroom-'));
  let now = 1800000000000;
  const setupToken = randomBytes(24).toString('hex');
  const state = { directory, setupToken, store: null, api: null, server: null, origin: '' };
  state.start = async () => {
    state.store = await ClassroomStore.open(directory, { now: () => now });
    state.api = new ClassroomApi(state.store, { setupToken, secureCookies: false });
    state.server = createAppServer({ school: state.api }).listen(0, '127.0.0.1');
    await once(state.server, 'listening'); state.origin = `http://127.0.0.1:${state.server.address().port}`; state.api.options.publicOrigin = state.origin;
  };
  state.stop = async () => { await new Promise(resolve => { state.server.close(resolve); state.server.closeAllConnections(); }); state.store.close(); };
  state.advance = duration => { now += duration; };
  state.client = () => {
    const client = { cookie: '', csrf: '' };
    client.request = async (route, method = 'GET', data, extra = {}) => {
      const binary = data instanceof Uint8Array || data instanceof ArrayBuffer;
      const headers = { Origin: state.origin, ...(client.cookie ? { Cookie: client.cookie } : {}), ...(client.csrf ? { 'X-CSRF-Token': client.csrf } : {}), ...(data !== undefined ? { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' } : {}), ...extra };
      const response = await fetch(state.origin + route, { method, headers, ...(data !== undefined ? { body: binary ? data : JSON.stringify(data) } : {}) });
      const cookie = response.headers.getSetCookie()[0]; if (cookie) client.cookie = cookie.split(';')[0];
      const buffer = Buffer.from(await response.arrayBuffer());
      const json = response.headers.get('content-type')?.includes('application/json') && buffer.length ? JSON.parse(buffer.toString()) : null;
      if (json?.csrf) client.csrf = json.csrf;
      return { status: response.status, data: json, bytes: buffer, headers: response.headers };
    };
    client.login = (username, password) => client.request('/api/login', 'POST', { username, password });
    return client;
  };
  await state.start();
  t.after(async () => { await state.stop(); if (path.dirname(directory) !== path.resolve(tmpdir()) || !path.basename(directory).startsWith('groove-classroom-')) throw new Error('Unexpected test cleanup path'); await rm(directory, { recursive: true }); });
  return state;
}

test('school accounts, shared music and private progress work across sessions and server restarts', async t => {
  const env = await fixture(t), owner = env.client(), guest = env.client();
  const initial = await guest.request('/api/session'); assert.equal(initial.data.enabled, true); assert.equal(initial.data.setupNeeded, true);
  assert.equal((await guest.request('/api/setup', 'POST', { username: 'owner', name: 'Owner', schoolName: 'Test school', password: passphrase })).status, 403);
  assert.equal((await guest.request('/api/setup', 'POST', {}, { Origin: 'https://elsewhere.example' })).status, 403);
  const setup = await owner.request('/api/setup', 'POST', { username: 'owner', name: 'Owner', schoolName: 'Test school', password: passphrase, setupToken: env.setupToken });
  assert.equal(setup.status, 200); assert.equal(setup.data.user.role, 'owner');
  assert.match(setup.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/); assert.equal('password_hash' in setup.data.user, false);
  assert.equal((await owner.request('/api/setup', 'POST', { username: 'owner2', name: 'Second', schoolName: 'Test school', password: passphrase, setupToken: env.setupToken })).status, 409);
  assert.equal((await guest.request('/api/library')).status, 401);
  assert.equal((await guest.request('/api/storage')).status, 401);
  const storage = await owner.request('/api/storage'); assert.equal(storage.status, 200); assert.equal(storage.data.schoolId, env.store.setting('school_id')); assert.equal(storage.data.accounts, 1); assert.equal('password_hash' in storage.data, false);
  assert.equal((await owner.request('/api/users', 'POST', {}, { 'X-CSRF-Token': 'é'.repeat(43) })).status, 403);

  async function teacher(username) {
    const created = await owner.request('/api/users', 'POST', { role: 'teacher', username, name: username }); assert.equal(created.status, 201);
    const client = env.client(); assert.equal((await client.login(username, created.data.temporaryPassword)).status, 200);
    assert.equal((await client.request('/api/library')).status, 428);
    assert.equal((await client.request('/api/password', 'POST', { currentPassword: created.data.temporaryPassword, password: passphrase })).status, 200);
    return { client, user: created.data.user };
  }
  const teacherA = await teacher('teacher.a'), teacherB = await teacher('teacher.b');
  async function student(teacher, username) {
    const created = await teacher.client.request('/api/users', 'POST', { username, name: username }); assert.equal(created.status, 201);
    const client = env.client(); await client.login(username, created.data.temporaryPassword);
    assert.equal((await client.request('/api/runs', 'POST', result())).status, 428);
    await client.request('/api/password', 'POST', { currentPassword: created.data.temporaryPassword, password: passphrase });
    return { client, user: created.data.user };
  }
  const studentA = await student(teacherA, 'student.a'), studentB = await student(teacherB, 'student.b');
  assert.equal((await teacherA.client.request('/api/storage')).status, 403);
  assert.equal((await studentA.client.request('/api/storage')).status, 403);
  assert.equal((await teacherA.client.request('/api/users')).data.users.length, 1);
  assert.equal((await owner.request('/api/users')).data.users.length, 4);
  assert.equal((await studentA.client.request('/api/users')).status, 403);
  assert.equal((await studentA.client.request('/api/users', 'POST', { username: 'intruder', name: 'Intruder' })).status, 403);
  assert.equal((await teacherA.client.request('/api/users', 'POST', { username: 'intruder', name: 'Intruder', role: 'teacher' })).status, 403);
  assert.equal((await studentA.client.request(`/api/users/${studentB.user.id}/progress`)).status, 404);
  assert.equal((await teacherA.client.request(`/api/users/${studentB.user.id}/progress`)).status, 404);

  const midi = createDemoMidi(), audio = new Uint8Array(createDemoWav());
  const metadata = { title: 'Shared original groove', fileName: 'Original.mid', audioName: 'Original.wav', selected: ['1:9'], mapping: {}, offset: -0.2, timeScale: 1.05, volume: 0.6, midiBytes: midi.length, audioBytes: audio.length };
  assert.equal((await studentA.client.request('/api/library/uploads', 'POST', metadata)).status, 403);
  const begun = await teacherA.client.request('/api/library/uploads', 'POST', metadata); assert.equal(begun.status, 201);
  const { uploadId, songId } = begun.data;
  assert.equal((await studentB.client.request('/api/library')).data.songs.length, 0);
  assert.equal((await teacherA.client.request(`/api/library/uploads/${uploadId}/publish`, 'POST', {})).status, 409);
  assert.equal((await teacherB.client.request(`/api/library/uploads/${uploadId}/midi`, 'PUT', midi)).status, 404);
  assert.equal((await teacherA.client.request(`/api/library/uploads/${uploadId}/midi`, 'PUT', midi)).status, 200);
  assert.equal((await teacherA.client.request(`/api/library/uploads/${uploadId}/audio`, 'PUT', audio)).status, 200);
  const published = await teacherA.client.request(`/api/library/uploads/${uploadId}/publish`, 'POST', {});
  assert.equal(published.status, 200); assert.equal(published.data.song.timeScale, 1.05); assert.equal(published.data.song.offset, -0.2);
  assert.equal((await studentB.client.request('/api/library')).data.songs[0].title, metadata.title);
  const midiRoute = `/api/library/${songId}/revisions/${uploadId}/midi`;
  const downloaded = await studentA.client.request(midiRoute); assert.equal(downloaded.status, 200); assert.deepEqual(downloaded.bytes, Buffer.from(midi)); assert.match(downloaded.headers.get('cache-control'), /no-store/);
  assert.equal((await guest.request(midiRoute)).status, 401);
  const backing = await studentB.client.request(`/api/library/${songId}/revisions/${uploadId}/audio`); assert.deepEqual(backing.bytes, Buffer.from(audio));
  assert.equal((await teacherB.client.request(`/api/library/${songId}/archive`, 'POST', { archived: true })).status, 404);
  assert.equal((await studentA.client.request(`/api/library/${songId}/archive`, 'POST', { archived: true })).status, 403);
  assert.equal((await teacherB.client.request('/api/library/uploads', 'POST', { ...metadata, songId, revisionId: uploadId })).status, 404);

  const practice = result(); assert.equal((await studentA.client.request('/api/runs', 'POST', practice)).status, 200);
  assert.equal((await studentA.client.request('/api/runs', 'POST', practice)).data.duplicate, true);
  const ownProgress = await studentA.client.request(`/api/users/${studentA.user.id}/progress`);
  assert.equal(ownProgress.data.summary.attempts, 1); assert.equal(ownProgress.data.records[0].title, 'First rock beat');
  assert.equal(ownProgress.data.records[0].accuracy, 6 / 9 * 100);
  assert.equal((await teacherA.client.request(`/api/users/${studentA.user.id}/progress`)).status, 200);
  assert.equal((await teacherB.client.request(`/api/users/${studentA.user.id}/progress`)).status, 404);
  const schoolRun = { ...result(), sourceKind: 'school', sourceId: songId, revisionId: uploadId };
  assert.equal((await studentB.client.request('/api/runs', 'POST', schoolRun)).status, 200);
  assert.equal((await owner.request(`/api/users/${studentB.user.id}/progress`)).data.records[0].title, metadata.title);
  assert.equal((await studentB.client.request('/api/runs', 'POST', practice)).status, 409);

  await teacherA.client.request(`/api/library/${songId}/archive`, 'POST', { archived: true });
  assert.equal((await studentB.client.request('/api/library')).data.songs.length, 0);
  assert.equal((await studentB.client.request(midiRoute)).status, 404);
  assert.equal((await teacherA.client.request('/api/library?archived=true')).data.songs.length, 1);
  await teacherA.client.request(`/api/library/${songId}/archive`, 'POST', { archived: false });
  const hash = env.store.user(studentA.user.id).password_hash; assert.match(hash, /^scrypt:131072:8:1:/); assert.ok(!hash.includes(passphrase));
  assert.ok(!env.store.db.prepare('SELECT hash FROM sessions').all().some(row => studentA.client.cookie.includes(row.hash)));

  await env.stop(); await env.start();
  assert.equal((await studentA.client.request('/api/session')).data.user.id, studentA.user.id);
  assert.equal((await studentA.client.request(`/api/users/${studentA.user.id}/progress`)).data.summary.attempts, 1);
  assert.deepEqual((await studentB.client.request(midiRoute)).bytes, Buffer.from(midi));
  const otherComputer = env.client(); await otherComputer.login('student.a', passphrase);
  assert.equal((await otherComputer.request(`/api/users/${studentA.user.id}/progress`)).data.summary.attempts, 1);
  assert.equal((await otherComputer.request('/api/library')).data.songs.length, 1);
  const reset = await teacherA.client.request(`/api/users/${studentA.user.id}/reset-password`, 'POST', {}); assert.equal(reset.status, 200);
  assert.equal((await otherComputer.request(`/api/users/${studentA.user.id}/progress`)).status, 401);
  assert.equal((await otherComputer.login('student.a', passphrase)).status, 401);
  await otherComputer.login('student.a', reset.data.temporaryPassword);
  assert.equal((await otherComputer.request('/api/library')).status, 428);
  await otherComputer.request('/api/password', 'POST', { currentPassword: reset.data.temporaryPassword, password: passphrase });
  await teacherA.client.request(`/api/users/${studentA.user.id}/active`, 'POST', { active: false });
  assert.equal((await otherComputer.request('/api/session')).data.user, null);
  assert.equal((await otherComputer.login('student.a', passphrase)).status, 401);
  await teacherA.client.request(`/api/users/${studentA.user.id}/active`, 'POST', { active: true });
  await otherComputer.login('student.a', passphrase);
  await otherComputer.request('/api/logout', 'POST', {});
  assert.equal((await otherComputer.request('/api/library')).status, 401);
});

test('practice validation rejects malformed scores and pagination retains equal-time attempts', async t => {
  const env = await fixture(t), owner = env.client();
  await owner.request('/api/setup', 'POST', { username: 'owner', name: 'Owner', schoolName: 'Test school', password: passphrase, setupToken: env.setupToken });
  for (const change of [{ hits: 9 }, { total: 0 }, { meanAbsMs: -1 }, { meanMs: 141 }, { tolerance: 300 }, { repeats: 3 }, { bestStreak: 7 }, { drums: [] }, { drums: [null] }, { section: '0–2' }, { section: '4–2' }]) assert.throws(() => validateSchoolRun({ ...result(), ...change }), error => error.status === 400);
  const ids = new Set();
  for (let i = 0; i < 55; i++) { const run = result(); ids.add(run.id); assert.equal((await owner.request('/api/runs', 'POST', run)).status, 200); }
  const actor = (await owner.request('/api/session')).data.user;
  const first = await owner.request(`/api/users/${actor.id}/progress`); assert.equal(first.data.records.length, 50);
  const second = await owner.request(`/api/users/${actor.id}/progress?cursor=${first.data.nextCursor}`); assert.equal(second.data.records.length, 5);
  assert.deepEqual(new Set([...first.data.records, ...second.data.records].map(run => run.id)), ids);
  assert.equal((await owner.request(`/api/users/${actor.id}/progress?cursor=invalid`)).status, 400);
  env.advance(61 * 60 * 1000);
  assert.equal((await owner.request('/api/library')).status, 401);
});

test('upload publication validates actual MIDI, enforces size and quota, and keeps earlier versions intact', async t => {
  const env = await fixture(t), owner = env.client();
  await owner.request('/api/setup', 'POST', { username: 'owner', name: 'Owner', schoolName: 'Test school', password: passphrase, setupToken: env.setupToken });
  const midi = createDemoMidi(), meta = { title: 'Original', fileName: 'Original.mid', audioName: '', selected: ['1:9'], mapping: {}, offset: 0, timeScale: 1, volume: 0.6, midiBytes: midi.length, audioBytes: 0 };
  const first = (await owner.request('/api/library/uploads', 'POST', meta)).data;
  assert.equal((await owner.request(`/api/library/uploads/${first.uploadId}/midi`, 'PUT', midi.slice(0, 15))).status, 400);
  await owner.request(`/api/library/uploads/${first.uploadId}/midi`, 'PUT', midi);
  assert.equal((await owner.request(`/api/library/uploads/${first.uploadId}/publish`, 'POST', {})).status, 200);
  const update = (await owner.request('/api/library/uploads', 'POST', { ...meta, title: 'Updated', songId: first.songId, revisionId: first.uploadId })).data;
  assert.equal((await owner.request('/api/library')).data.songs[0].title, 'Original');
  const badMidi = new Uint8Array(midi.length);
  await owner.request(`/api/library/uploads/${update.uploadId}/midi`, 'PUT', badMidi);
  assert.equal((await owner.request(`/api/library/uploads/${update.uploadId}/publish`, 'POST', {})).status, 400);
  assert.equal((await owner.request('/api/library')).data.songs[0].title, 'Original');
  await owner.request(`/api/library/uploads/${update.uploadId}/midi`, 'PUT', midi);
  assert.equal((await owner.request(`/api/library/uploads/${update.uploadId}/publish`, 'POST', {})).status, 200);
  assert.equal((await owner.request('/api/library')).data.songs[0].title, 'Updated');
  assert.equal((await owner.request('/api/library/uploads', 'POST', { ...meta, songId: first.songId, revisionId: first.uploadId })).status, 409);
  assert.equal((await owner.request('/api/library/uploads', 'POST', { ...meta, offset: 301 })).status, 400);
  env.store.storageLimit = 1;
  assert.equal((await owner.request('/api/library/uploads', 'POST', meta)).status, 413);
  env.store.storageLimit = 1024 * 1024;
  const discarded = (await owner.request('/api/library/uploads', 'POST', meta)).data;
  await owner.request(`/api/library/uploads/${discarded.uploadId}/midi`, 'PUT', midi);
  assert.equal((await owner.request(`/api/library/uploads/${discarded.uploadId}`, 'DELETE')).status, 200);
  await assert.rejects(readFile(env.store.musicPath(discarded.uploadId, 'midi')), { code: 'ENOENT' });
  assert.equal((await owner.request('/api/library')).data.songs.length, 1);
});

test('private backups restore accounts, published music and results without sessions or drafts; owner recovery revokes sessions', async t => {
  const env = await fixture(t), owner = env.client();
  const setup = await owner.request('/api/setup', 'POST', { username: 'owner', name: 'Owner', schoolName: 'Test school', password: passphrase, setupToken: env.setupToken });
  await owner.request('/api/runs', 'POST', result());
  const midi = createDemoMidi(), meta = { title: 'Backup song', fileName: 'Backup.mid', audioName: '', selected: ['1:9'], mapping: {}, offset: 0, timeScale: 1, volume: 0.6, midiBytes: midi.length, audioBytes: 0 };
  const song = (await owner.request('/api/library/uploads', 'POST', meta)).data;
  await owner.request(`/api/library/uploads/${song.uploadId}/midi`, 'PUT', midi); await owner.request(`/api/library/uploads/${song.uploadId}/publish`, 'POST', {});
  const pending = (await owner.request('/api/library/uploads', 'POST', meta)).data;
  await owner.request(`/api/library/uploads/${pending.uploadId}/midi`, 'PUT', midi);
  const output = path.join(tmpdir(), `groove-school-backup-${randomUUID()}`);
  t.after(async () => { if (path.dirname(output) !== path.resolve(tmpdir()) || !path.basename(output).startsWith('groove-school-backup-')) throw new Error('Unexpected backup cleanup path'); await rm(output, { recursive: true }); });
  const manifest = await backupSchool(env.directory, output); assert.equal(manifest.accounts, 1); assert.equal(manifest.attempts, 1); assert.equal(manifest.songVersions, 1);
  const restored = await ClassroomStore.open(output);
  try {
    assert.ok(restored.hasOwner()); assert.equal(restored.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0); assert.equal(restored.db.prepare("SELECT COUNT(*) AS n FROM revisions WHERE state='draft'").get().n, 0);
    assert.equal(restored.progress(setup.data.user, setup.data.user.id).summary.attempts, 1);
    assert.deepEqual(await readFile(restored.musicPath(song.uploadId, 'midi')), Buffer.from(midi));
    await assert.rejects(readFile(restored.musicPath(pending.uploadId, 'midi')), { code: 'ENOENT' });
  } finally { restored.close(); }
  await assert.rejects(backupSchool(env.directory, output), { code: 'EEXIST' });
  const recovery = await promisify(execFile)(process.execPath, ['scripts/reset-school-owner.mjs'], { cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, GROOVE_DATA_DIR: env.directory } });
  const temporary = recovery.stdout.match(/Temporary password: (\S+)/)?.[1]; assert.ok(temporary?.length >= 15);
  assert.equal((await owner.request('/api/library')).status, 401);
  const recovered = env.client(); assert.equal((await recovered.login('owner', temporary)).data.user.mustChangePassword, true);
});

test('bootstrap attempts are throttled, production cookies are secure, and school data cannot be served publicly', async t => {
  const env = await fixture(t), guest = env.client();
  for (let i = 0; i < 10; i++) assert.equal((await guest.request('/api/setup', 'POST', { username: 'probe', setupToken: 'wrong' })).status, 403);
  assert.equal((await guest.request('/api/setup', 'POST', { username: 'probe', setupToken: 'wrong' })).status, 429);
  env.api.options.secureCookies = true;
  const setup = await guest.request('/api/setup', 'POST', { username: 'owner', name: 'Owner', schoolName: 'Test school', password: passphrase, setupToken: env.setupToken });
  assert.equal(setup.status, 200); assert.match(setup.headers.get('set-cookie'), /^__Host-groove_session=/); assert.match(setup.headers.get('set-cookie'), /; Secure/);
  assert.equal((await guest.request('/school.sqlite')).status, 404);
  assert.equal((await guest.request('/.groove-data/school.sqlite')).status, 403);
  const page = await fetch(env.origin); assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
});
