import { DatabaseSync, backup } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFile, realpath, stat, mkdir, writeFile, chmod, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAND_SCHEMA } from './band-results.mjs';

export const STORAGE_UNAVAILABLE = 'School storage is unavailable. Account changes are paused to protect existing data. The school owner needs to check the attached volume, data folder and backups. Individual practice still works.';
const within = (root, target) => { const relative = path.relative(root, target); return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
const maybeStat = file => stat(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
async function futureRealpath(target) {
  try { return await realpath(target); }
  catch (error) { if (error.code !== 'ENOENT') throw error; const parent = path.dirname(target); if (parent === target) throw error; return path.join(await futureRealpath(parent), path.basename(target)); }
}

// Run before opening a writable database. No fallback directory on a bad mount.
export async function prepareSchoolStorage({ directory, local = false, env = process.env, version }) {
  if (!directory) return null;
  if (!path.isAbsolute(directory)) throw new Error('GROOVE_DATA_DIR must be an absolute, private path.');
  const resolved = path.resolve(directory);
  const publicRoot = fileURLToPath(new URL('../dist/', import.meta.url));
  if (within(publicRoot, resolved) || within(await realpath(publicRoot), await futureRealpath(resolved))) throw new Error('School storage must stay outside the public dist directory.');
  const railway = !local && Boolean(env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_PUBLIC_DOMAIN);
  let volumeVerified = false;
  if (railway) {
    const mount = env.RAILWAY_VOLUME_MOUNT_PATH;
    if (!mount || !path.isAbsolute(mount)) throw new Error('No Railway volume mount was detected. Attach the existing school volume; do not manually set RAILWAY_VOLUME_MOUNT_PATH.');
    const mounted = await realpath(mount);
    if (!within(mounted, await futureRealpath(resolved))) throw new Error('GROOVE_DATA_DIR is outside the attached Railway volume. Keep the original volume and correct the data path.');
    volumeVerified = true;
  }
  let marker = null;
  try {
    marker = JSON.parse(await readFile(path.join(resolved, 'storage-identity.json'), 'utf8'));
    if (marker.version !== 1 || typeof marker.schoolId !== 'string' || !marker.schoolId) throw new Error('Invalid storage identity.');
  } catch (error) { if (error.code !== 'ENOENT') throw new Error('School storage identity could not be verified. Keep the files intact and check a backup.'); }
  const expected = env.GROOVE_EXPECTED_SCHOOL_ID || marker?.schoolId || null;
  const allowNew = local || env.GROOVE_ALLOW_NEW_SCHOOL === '1';
  const database = path.join(resolved, 'school.sqlite'), info = await maybeStat(database);
  const result = { directory: resolved, volumeVerified, local, snapshot: null, newSchoolAllowed: allowNew, schoolId: null };
  if (!info) {
    if (marker || expected || !allowNew) throw new Error('The existing school database was not found. Restore the original volume/database. GROOVE_ALLOW_NEW_SCHOOL=1 is only for intentionally creating a new school.');
    return result;
  }
  if (!info.isFile() || info.size === 0) throw new Error('The school database is empty or invalid. Restore it from a backup rather than reinitializing it.');
  const source = new DatabaseSync(database, { readOnly: true });
  try {
    if (source.prepare('PRAGMA quick_check(1)').get().quick_check !== 'ok') throw new Error('The school database failed its integrity check. Restore a verified backup.');
    if (source.prepare('PRAGMA user_version').get().user_version > BAND_SCHEMA) throw new Error('This database needs a newer app version. Refusing to downgrade it.');
    const schoolId = source.prepare("SELECT value FROM settings WHERE key='school_id'").get()?.value;
    if (!schoolId || (expected && expected !== schoolId) || (marker && marker.schoolId !== schoolId)) throw new Error('The school identity does not match this database. Check the selected volume, environment and GROOVE_EXPECTED_SCHOOL_ID.');
    result.schoolId = schoolId;
    const hasOwner = Boolean(source.prepare("SELECT id FROM users WHERE role='owner'").get());
    if (!hasOwner && !allowNew) throw new Error('No school owner was found in this database. Check the original volume or restore a backup; use GROOVE_ALLOW_NEW_SCHOOL=1 only for an intentional new school.');
    if (hasOwner) result.snapshot = await databaseRecoveryCopy(source, resolved, version);
    return result;
  } finally { source.close(); }
}

async function databaseRecoveryCopy(source, directory, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error('A valid app version is required for the recovery copy.');
  const folder = path.join(directory, 'recovery');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const filename = `school-before-${version}.sqlite`, destination = path.join(folder, filename);
  const existing = await maybeStat(destination);
  if (existing) {
    const check = new DatabaseSync(destination, { readOnly: true });
    try {
      if (check.prepare('PRAGMA quick_check(1)').get().quick_check !== 'ok' || check.prepare("SELECT value FROM settings WHERE key='school_id'").get()?.value !== source.prepare("SELECT value FROM settings WHERE key='school_id'").get()?.value) throw new Error('The existing recovery copy is invalid. Preserve it and check school storage.');
    } finally { check.close(); }
    return { file: `recovery/${filename}`, createdAt: existing.mtime.toISOString(), version };
  }
  const temporary = path.join(folder, `.snapshot-${randomUUID()}.sqlite`);
  try {
    await backup(source, temporary); await chmod(temporary, 0o600);
    const copy = new DatabaseSync(temporary);
    try {
      copy.exec("PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON; DELETE FROM sessions; DELETE FROM revisions WHERE state='draft'; DELETE FROM songs WHERE revision_id IS NULL;");
      if (copy.prepare('PRAGMA quick_check(1)').get().quick_check !== 'ok') throw new Error('Database recovery copy did not pass its integrity check.');
    } finally { copy.close(); }
    // Atomic, exclusive publication. Never overwrite an earlier recovery copy.
    await link(temporary, destination);
    return { file: `recovery/${filename}`, createdAt: (await stat(destination)).mtime.toISOString(), version };
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

export async function sealSchoolStorage(store, storage) {
  const schoolId = store.setting('school_id');
  if (storage.schoolId && storage.schoolId !== schoolId) throw new Error('School identity changed while opening the database.');
  const marker = path.join(storage.directory, 'storage-identity.json');
  try { await writeFile(marker, JSON.stringify({ version: 1, schoolId }) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (JSON.parse(await readFile(marker, 'utf8')).schoolId !== schoolId) throw new Error('School storage identity does not match.');
  }
  return { ...storage, schoolId };
}
