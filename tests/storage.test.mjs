import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, unlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { ClassroomStore } from '../server/classroom.mjs';
import { prepareSchoolStorage, sealSchoolStorage } from '../server/storage.mjs';
import { createDemoMidi } from '../dist/demo-data.mjs';

async function fixture(t, { initialized = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'groove-storage-')), volume = path.join(root, 'volume'), directory = path.join(volume, 'school');
  await mkdir(volume);
  const env = { RAILWAY_PROJECT_ID: 'synthetic-project', RAILWAY_VOLUME_MOUNT_PATH: volume };
  let store = null, owner = null;
  if (initialized) {
    store = await ClassroomStore.open(directory);
    owner = (await store.setup({ username: 'owner', name: 'Synthetic teacher', schoolName: 'Synthetic school', password: 'synthetic practice passphrase' })).user;
  }
  const state = { root, volume, directory, env, owner, get store() { return store; }, close() { store?.close(); store = null; }, async reopen() { store = await ClassroomStore.open(directory); return store; }, prepare: (extra = {}) => prepareSchoolStorage({ directory, env, version: '0.10.0', ...extra }) };
  t.after(async () => { state.close(); if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('groove-storage-')) throw new Error('Unexpected cleanup path'); await rm(root, { recursive: true }); });
  return state;
}
test('Railway storage requires a real existing mount and a data path inside it, without creating fallback folders', async t => {
  const env = await fixture(t, { initialized: false });
  await assert.rejects(env.prepare({ env: { RAILWAY_PROJECT_ID: 'test' } }), /No Railway volume/);
  await assert.rejects(env.prepare({ directory: path.join(env.root, 'outside') }), /outside the attached/);
  await assert.rejects(env.prepare({ directory: 'relative/path' }), /absolute/);
  await assert.rejects(env.prepare({ env: { ...env.env, RAILWAY_VOLUME_MOUNT_PATH: path.join(env.root, 'missing') } }), /ENOENT/);
  await assert.rejects(env.prepare({ directory: fileURLToPath(new URL('../dist/private-school/', import.meta.url)) }), /public dist/);
  assert.deepEqual(await readdir(env.volume), []);
});
test('an empty or replacement volume cannot silently create a new school; first setup requires explicit intent', async t => {
  const env = await fixture(t, { initialized: false });
  await assert.rejects(env.prepare(), /existing school database was not found/);
  const initial = await env.prepare({ env: { ...env.env, GROOVE_ALLOW_NEW_SCHOOL: '1' } }); assert.equal(initial.newSchoolAllowed, true);
  const store = await env.reopen(); await sealSchoolStorage(store, initial);
  await assert.rejects(env.prepare(), /No school owner/);
  env.close(); await unlink(path.join(env.directory, 'school.sqlite'));
  await assert.rejects(env.prepare({ env: { ...env.env, GROOVE_ALLOW_NEW_SCHOOL: '1' } }), /existing school database was not found/);
});
test('updates retain the same accounts, three published songs and their bytes, creating a consistent recovery copy first', async t => {
  const env = await fixture(t);
  await env.store.createUser(env.owner, { role: 'student', name: 'Synthetic student', username: 'student' });
  const midi = createDemoMidi(); const published = [];
  for (let i = 0; i < 3; i++) {
    const upload = env.store.beginUpload(env.owner, { title: `Synthetic groove ${i + 1}`, fileName: 'groove.mid', selected: ['1:9'], mapping: {}, offset: 0, timeScale: 1, volume: .65, midiBytes: midi.length, audioBytes: 0 });
    const stream = Readable.from([midi]); stream.headers = {};
    await env.store.receiveFile(env.owner, upload.uploadId, 'midi', stream); await env.store.publish(env.owner, upload.uploadId); published.push(upload);
  }
  const id = env.store.setting('school_id'), passwordHash = env.store.user(env.owner.id).password_hash;
  const prepared = await env.prepare(); assert.equal(prepared.volumeVerified, true);
  const sealed = await sealSchoolStorage(env.store, prepared); assert.equal(sealed.schoolId, id); assert.ok(sealed.snapshot.file);
  const copy = new DatabaseSync(path.join(env.directory, sealed.snapshot.file), { readOnly: true });
  try { assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2); assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM songs').get().n, 3); assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0); } finally { copy.close(); }
  const copyBefore = await readFile(path.join(env.directory, sealed.snapshot.file));
  env.close(); await env.prepare(); await env.reopen();
  assert.equal(env.store.setting('school_id'), id); assert.equal(env.store.user(env.owner.id).password_hash, passwordHash);
  assert.equal(env.store.listSongs(env.owner).length, 3);
  for (const song of published) assert.deepEqual(await readFile(env.store.musicPath(song.uploadId, 'midi')), Buffer.from(midi));
  assert.deepEqual(await readFile(path.join(env.directory, sealed.snapshot.file)), copyBefore);
  assert.deepEqual((await readdir(path.join(env.directory, 'recovery'))).filter(file => file.startsWith('.snapshot')), []);
});
test('school identity guards catch a changed database or accidentally selected replacement volume', async t => {
  const first = await fixture(t), second = await fixture(t);
  const prepared = await first.prepare(); await sealSchoolStorage(first.store, prepared);
  await assert.rejects(second.prepare({ env: { ...second.env, GROOVE_EXPECTED_SCHOOL_ID: first.store.setting('school_id') } }), /identity does not match/);
  await writeFile(path.join(first.directory, 'storage-identity.json'), JSON.stringify({ version: 1, schoolId: second.store.setting('school_id') }));
  await assert.rejects(first.prepare(), /identity does not match/);
  assert.equal(first.store.hasOwner(), true); assert.equal(second.store.hasOwner(), true);
});
test('corrupt databases, newer schemas and broken identity files are left intact', async t => {
  const env = await fixture(t); env.close();
  await writeFile(path.join(env.directory, 'storage-identity.json'), 'broken identity');
  await assert.rejects(env.prepare(), /identity could not be verified/); await unlink(path.join(env.directory, 'storage-identity.json'));
  const db = new DatabaseSync(path.join(env.directory, 'school.sqlite')); db.exec('PRAGMA user_version=99'); db.close();
  await assert.rejects(env.prepare(), /newer app version/); await assert.rejects(ClassroomStore.open(env.directory), /newer app version/);
  const confirm = new DatabaseSync(path.join(env.directory, 'school.sqlite')); assert.equal(confirm.prepare('PRAGMA user_version').get().user_version, 99); confirm.close();
  await writeFile(path.join(env.directory, 'school.sqlite'), 'not a database');
  await assert.rejects(env.prepare()); assert.equal((await readFile(path.join(env.directory, 'school.sqlite'))).toString(), 'not a database');
});
test('local development still creates an isolated school without production initialization flags', async t => {
  const env = await fixture(t, { initialized: false }); const local = await env.prepare({ local: true, env: {} }); assert.equal(local.local, true); assert.equal(local.volumeVerified, false);
  const store = await env.reopen(); await sealSchoolStorage(store, local); assert.ok((await stat(path.join(env.directory, 'storage-identity.json'))).isFile());
});
