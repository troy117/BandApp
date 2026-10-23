import { validateRunReport } from '../dist/run-report.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, timingSafeEqual, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, open, rename, unlink, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMidiSong } from '../dist/midi.mjs';
import { validateAlignment } from '../dist/sync.mjs';
import { DRUMS, GROOVES } from '../dist/engine.mjs';
import { arrangementParts, importedArrangement } from '../dist/arrangements.mjs';
import { BAND_SCHEMA, migrateBandStorage } from './band-results.mjs';
import { passwordMinimum, PASSWORD_MAX_LENGTH } from '../dist/password-policy.mjs';
import { lyricText } from '../dist/lyrics.mjs';
import { studentInstrument } from '../dist/student-preferences.mjs';

const derivePassword = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string') return false; const first = Buffer.from(a), second = Buffer.from(b); return first.length === second.length && timingSafeEqual(first, second); };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isStaff = user => user.role === 'teacher' || user.role === 'owner';
const cleanText = (value, limit, label) => { if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f]/.test(value)) throw new SchoolError(400, `Enter a valid ${label}.`); return value.trim(); };
const usernameValue = value => { const name = String(value || '').toLowerCase().trim(); if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(name)) throw new SchoolError(400, 'Use a username of 3–40 letters, numbers, dots, dashes or underscores.'); return name; };
const passwordValue = (value, role) => { const minimum = passwordMinimum(role); if (typeof value !== 'string' || value.length < minimum || value.length > PASSWORD_MAX_LENGTH || !value.trim()) throw new SchoolError(400, `Use a password of ${minimum}–${PASSWORD_MAX_LENGTH} characters.`); return value; };
const publicUser = row => row ? { id: row.id, username: row.username, name: row.name, role: row.role, teacherId: row.teacher_id, active: Boolean(row.active), mustChangePassword: Boolean(row.must_change), defaultInstrument: row.default_instrument || 'drums' } : null;

export class SchoolError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export class SchoolPasswords {
  constructor() { this.running = 0; this.waiters = []; }
  async derive(password, salt) {
    if (this.running >= 2) {
      if (this.waiters.length >= 32) throw new SchoolError(503, 'Sign-in is busy. Try again in a moment.');
      await new Promise(resolve => this.waiters.push(resolve));
    } else this.running++;
    try { return await derivePassword(password, salt, 32, { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 }); }
    finally { if (this.waiters.length) this.waiters.shift()(); else this.running--; }
  }
  async hash(password, role) { const salt = randomBytes(16).toString('hex'); return `scrypt:131072:8:1:${salt}:${(await this.derive(passwordValue(password, role), salt)).toString('hex')}`; }
  async verify(password, encoded) {
    const parts = String(encoded || '').split(':');
    const valid = parts.length === 6 && parts.slice(0, 4).join(':') === 'scrypt:131072:8:1' && /^[0-9a-f]{32}$/.test(parts[4]) && /^[0-9a-f]{64}$/.test(parts[5]);
    const result = await this.derive(typeof password === 'string' && password.length <= 128 ? password : '', valid ? parts[4] : '00000000000000000000000000000000');
    return valid && safeEqual(result.toString('hex'), parts[5]);
  }
}

export class ClassroomStore {
  static async open(directory, options = {}) {
    const resolved = path.resolve(directory), publicRoot = fileURLToPath(new URL('../dist/', import.meta.url));
    const relative = path.relative(publicRoot, resolved);
    if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) throw new Error('Classroom data must be outside the public dist directory.');
    await mkdir(path.join(resolved, 'music'), { recursive: true, mode: 0o700 });
    const store = new ClassroomStore(resolved, options);
    await store.cleanDrafts();
    return store;
  }
  constructor(directory, options) {
    this.directory = directory; this.now = options.now || Date.now; this.passwords = new SchoolPasswords(); this.uploading = new Set(); this.publishing = new Set();
    this.storageLimit = options.storageLimit ?? 1024 * 1024 * 1024;
    this.db = new DatabaseSync(path.join(directory, 'school.sqlite'));
    const schemaBefore = this.db.prepare('PRAGMA user_version').get().user_version;
    if (schemaBefore > BAND_SCHEMA) { this.db.close(); throw new Error('This school database requires a newer app version.'); }
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','teacher','student')), teacher_id TEXT REFERENCES users(id), password_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS one_owner ON users(role) WHERE role='owner';
      CREATE INDEX IF NOT EXISTS roster_teacher ON users(teacher_id,role);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS songs (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id), revision_id TEXT, archived INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, song_id TEXT NOT NULL REFERENCES songs(id), teacher_id TEXT NOT NULL REFERENCES users(id), base_revision TEXT, metadata TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'draft', midi_expected INTEGER NOT NULL, audio_expected INTEGER NOT NULL, midi_received INTEGER NOT NULL DEFAULT 0, audio_received INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS revisions_song ON revisions(song_id);
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, record TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS runs_user_date ON runs(user_id,created_at DESC);
      CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, subject_id TEXT, created_at INTEGER NOT NULL);
      `);
    migrateBandStorage(this.db);
    this.db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('school_id',?)").run(randomUUID());
  }
  close() { this.db.close(); }
  setting(key, fallback = '') { return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? fallback; }
  transaction(work) { this.db.exec('BEGIN IMMEDIATE'); try { const result = work(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  audit(actor, action, subject = null) { this.db.prepare('INSERT INTO audit(actor_id,action,subject_id,created_at) VALUES (?,?,?,?)').run(actor?.id ?? null, action, subject, this.now()); }
  user(id) { return this.db.prepare("SELECT users.*, (SELECT value FROM settings WHERE key='instrument:' || users.id) AS default_instrument FROM users WHERE id=?").get(id); }
  setInstrument(actor, userId, value) {
    const user = actor.id === userId ? this.user(userId) : (this.requireStaff(actor), this.manageable(actor, userId));
    if (!user) throw new SchoolError(404, 'Account not found.');
    let instrument; try { instrument = studentInstrument(value); } catch (error) { throw new SchoolError(400, error.message); }
    this.db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)').run('instrument:' + userId, instrument);
    return publicUser(this.user(userId));
  }
  hasOwner() { return Boolean(this.db.prepare("SELECT id FROM users WHERE role='owner'").get()); }
  session(token) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const session = this.db.prepare('SELECT * FROM sessions WHERE hash=?').get(digest(token));
    if (!session) return null;
    const user = this.user(session.user_id), now = this.now();
    if (!user?.active || session.expires_at <= now || session.last_seen <= now - 60 * 60 * 1000) { this.db.prepare('DELETE FROM sessions WHERE hash=?').run(session.hash); return null; }
    if (now - session.last_seen > 60000) { this.db.prepare('UPDATE sessions SET last_seen=? WHERE hash=?').run(now, session.hash); session.last_seen = now; }
    return { ...session, user: publicUser(user) };
  }
  makeSession(userId) {
    const token = randomBytes(32).toString('base64url'), csrf = randomBytes(32).toString('base64url'), now = this.now();
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=? OR last_seen<=?').run(now, now - 60 * 60 * 1000);
    this.db.prepare('INSERT INTO sessions(hash,user_id,csrf,expires_at,last_seen) VALUES (?,?,?,?,?)').run(digest(token), userId, csrf, now + 8 * 60 * 60 * 1000, now);
    return { token, csrf, user: publicUser(this.user(userId)), expiresAt: now + 8 * 60 * 60 * 1000 };
  }
  async setup(input) {
    if (this.hasOwner()) throw new SchoolError(409, 'The school owner account has already been created. Sign in instead.');
    const username = usernameValue(input.username), name = cleanText(input.name, 60, 'teacher name'), schoolName = cleanText(input.schoolName, 100, 'school name');
    const hash = await this.passwords.hash(input.password), id = randomUUID();
    this.transaction(() => {
      if (this.hasOwner()) throw new SchoolError(409, 'The school owner account has already been created.');
      this.db.prepare("INSERT INTO users(id,username,name,role,password_hash,created_at) VALUES (?,?,?,'owner',?,?)").run(id, username, name, hash, this.now());
      this.db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('school_name',?)").run(schoolName);
      this.audit({ id }, 'school.setup', id);
    });
    return this.makeSession(id);
  }
  async login(input) {
    const username = String(input.username || '').trim().toLowerCase();
    const before = this.db.prepare('SELECT * FROM users WHERE username=?').get(username);
    const valid = await this.passwords.verify(input.password, before?.password_hash);
    const after = before && this.user(before.id);
    if (!valid || !after?.active || after.password_hash !== before.password_hash) throw new SchoolError(401, 'The username or password is incorrect.');
    return this.makeSession(after.id);
  }
  requireStaff(actor) { if (!isStaff(actor)) throw new SchoolError(403, 'A teacher account is required.'); }
  manageable(actor, userId) {
    const user = this.user(userId);
    if (!user || user.id === actor.id || user.role === 'owner' || (actor.role !== 'owner' && !(actor.role === 'teacher' && user.role === 'student' && user.teacher_id === actor.id))) throw new SchoolError(404, 'Account not found.');
    return user;
  }
  roster(actor) {
    this.requireStaff(actor);
    const rows = actor.role === 'owner' ? this.db.prepare("SELECT * FROM users WHERE role!='owner' ORDER BY role,name").all() : this.db.prepare("SELECT * FROM users WHERE role='student' AND teacher_id=? ORDER BY name").all(actor.id);
    return rows.map(row => ({ ...publicUser(this.user(row.id)), ...this.progressSummary(row.id), teacherName: this.user(row.teacher_id)?.name ?? '' }));
  }
  async createUser(actor, input) {
    this.requireStaff(actor);
    const role = input.role || 'student';
    if (!['teacher', 'student'].includes(role) || (role === 'teacher' && actor.role !== 'owner')) throw new SchoolError(403, 'Only the school owner can add teachers.');
    const username = usernameValue(input.username), name = cleanText(input.name, 60, 'display name');
    let instrument; try { instrument = studentInstrument(input.defaultInstrument); } catch (error) { throw new SchoolError(400, error.message); }
    if (this.db.prepare('SELECT id FROM users WHERE username=?').get(username)) throw new SchoolError(409, 'That username is already in use.');
    if (this.db.prepare('SELECT COUNT(*) AS n FROM users').get().n >= 1000) throw new SchoolError(409, 'This school has reached the 1,000 account limit.');
    let teacherId = role === 'student' ? actor.id : null;
    if (role === 'student' && actor.role === 'owner' && input.teacherId) { const teacher = this.user(input.teacherId); if (!teacher?.active || !isStaff(teacher)) throw new SchoolError(400, 'Choose an active teacher.'); teacherId = teacher.id; }
    const chosen = input.password !== undefined && input.password !== '';
    if (chosen && role !== 'student') throw new SchoolError(400, 'Teacher-set passwords are for student accounts.');
    const password = chosen ? input.password : `drum-${randomBytes(9).toString('base64url')}`, hash = await this.passwords.hash(password, role), id = randomUUID();
    try { this.db.prepare('INSERT INTO users(id,username,name,role,teacher_id,password_hash,must_change,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, username, name, role, teacherId, hash, chosen ? 0 : 1, this.now()); }
    catch (error) { if (String(error.code).includes('CONSTRAINT') || /UNIQUE/.test(error.message)) throw new SchoolError(409, 'That username is already in use.'); throw error; }
    this.setInstrument(actor, id, instrument);
    this.audit(actor, 'account.create', id);
    return { user: publicUser(this.user(id)), ...(chosen ? {} : { temporaryPassword: password }) };
  }
  async resetPassword(actor, userId, input = {}) {
    this.requireStaff(actor);
    const user = this.manageable(actor, userId), chosen = input.password !== undefined && input.password !== '';
    if (chosen && user.role !== 'student') throw new SchoolError(400, 'Teacher-set passwords are for student accounts.');
    const password = chosen ? input.password : `drum-${randomBytes(9).toString('base64url')}`, hash = await this.passwords.hash(password, user.role);
    this.transaction(() => {
      const current = this.manageable(actor, userId);
      if (current.password_hash !== user.password_hash) throw new SchoolError(409, 'This password changed. Reload the roster and try again.');
      this.db.prepare('UPDATE users SET password_hash=?,must_change=? WHERE id=?').run(hash, chosen ? 0 : 1, user.id);
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); this.audit(actor, chosen ? 'account.password_set' : 'account.password_reset', user.id);
    });
    return { user: publicUser(this.user(user.id)), ...(chosen ? {} : { temporaryPassword: password }) };
  }
  setActive(actor, userId, active) {
    const user = this.manageable(actor, userId);
    if (typeof active !== 'boolean') throw new SchoolError(400, 'Choose whether this account is active.');
    this.transaction(() => { this.db.prepare('UPDATE users SET active=? WHERE id=?').run(active ? 1 : 0, user.id); this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id); this.audit(actor, active ? 'account.enable' : 'account.disable', user.id); });
    return publicUser(this.user(user.id));
  }
  async changePassword(actor, input) {
    const before = this.user(actor.id);
    if (!await this.passwords.verify(input.currentPassword, before.password_hash)) throw new SchoolError(400, 'The current password is incorrect.');
    const hash = await this.passwords.hash(input.password, before.role);
    this.transaction(() => {
      const updated = this.db.prepare('UPDATE users SET password_hash=?,must_change=0 WHERE id=? AND password_hash=?').run(hash, actor.id, before.password_hash);
      if (!updated.changes) throw new SchoolError(409, 'The password changed while this request was running. Sign in again.');
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(actor.id); this.audit(actor, 'account.password_change', actor.id);
    });
    return this.makeSession(actor.id);
  }
  progressSummary(userId) {
    const rows = this.db.prepare('SELECT record,created_at FROM runs WHERE user_id=? ORDER BY created_at DESC LIMIT 30').all(userId);
    const records = rows.map(row => JSON.parse(row.record)), count = this.db.prepare('SELECT COUNT(*) AS n FROM runs WHERE user_id=?').get(userId).n;
    return { attempts: count, lastPractice: rows[0]?.created_at ?? null, recentAccuracy: records.length ? records.reduce((sum, r) => sum + r.accuracy, 0) / records.length : null, recentTimingMs: records.filter(r => r.meanAbsMs !== null).length ? records.filter(r => r.meanAbsMs !== null).reduce((sum, r) => sum + r.meanAbsMs, 0) / records.filter(r => r.meanAbsMs !== null).length : null };
  }
  progress(actor, userId, cursor = null) {
    const user = this.user(userId);
    if (!user || (actor.id !== userId && actor.role !== 'owner' && !(actor.role === 'teacher' && user.role === 'student' && user.teacher_id === actor.id))) throw new SchoolError(404, 'Student results not found.');
    let before = { at: Number.MAX_SAFE_INTEGER, id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' };
    if (cursor) { try { before = JSON.parse(Buffer.from(cursor, 'base64url').toString()); if (!Number.isSafeInteger(before.at) || before.at < 0 || !uuidPattern.test(before.id)) throw new Error(); } catch { throw new SchoolError(400, 'Invalid results page.'); } }
    const rows = this.db.prepare('SELECT id,record,created_at FROM runs WHERE user_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 51').all(userId, before.at, before.at, before.id);
    return { user: publicUser(user), summary: this.progressSummary(userId), records: rows.slice(0, 50).map(row => JSON.parse(row.record)), nextCursor: rows.length > 50 ? Buffer.from(JSON.stringify({ at: rows[49].created_at, id: rows[49].id })).toString('base64url') : null };
  }
  checkedReport(record, value) {
    let report; try { report=validateRunReport(value); } catch(error) { throw new SchoolError(400,error.message); }
    const hits=report.notes.filter(n=>n[4]==='hit'), wrong=report.notes.filter(n=>n[4]==='wrong').length;
    if(report.notes.length!==record.total || hits.length!==record.hits || wrong!==(record.wrong||0) || report.extras.length!==record.extras || report.tolerance!==record.tolerance || report.instrument!==(record.instrument||'drums'))throw new SchoolError(400,'Note detail does not match the practice result.');
    return report;
  }
  writeReport(runId, report) { this.db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)').run('report:'+runId,JSON.stringify(report)); }
  runReport(actor, userId, runId) {
    const user=this.user(userId);
    if(!user || actor.id!==userId && actor.role!=='owner' && !(actor.role==='teacher' && user.role==='student' && user.teacher_id===actor.id))throw new SchoolError(404,'Practice report not found.');
    const row=this.db.prepare('SELECT record FROM runs WHERE id=? AND user_id=?').get(runId,userId);
    if(!row)throw new SchoolError(404,'Practice report not found.');
    const value=this.setting('report:'+runId);return {record:JSON.parse(row.record),report:value?JSON.parse(value):null};
  }
  saveRun(actor, input) {
    const record = validateSchoolRun(input);
    if (record.sourceKind === 'builtin') { if (!Object.hasOwn(GROOVES, record.sourceId)) throw new SchoolError(400, 'Unknown practice track.'); record.title = GROOVES[record.sourceId].name; record.grooveId = record.sourceId; }
    else if (record.sourceKind === 'school') { const revision = this.db.prepare("SELECT * FROM revisions WHERE id=? AND song_id=? AND state='published'").get(record.revisionId, record.sourceId); if (!revision) throw new SchoolError(400, 'Unknown school song version.'); record.title = JSON.parse(revision.metadata).title; record.grooveId = null; }
    const report=input.report ? this.checkedReport(record,input.report) : null;
    if(report){record.stopped=report.stopped;record.full=record.full&&!report.stopped;record.reportAvailable=true;}
    record.at = this.now();
    const existing = this.db.prepare('SELECT user_id FROM runs WHERE id=?').get(record.id);
    if (existing && existing.user_id !== actor.id) throw new SchoolError(409, 'That practice result identifier is already in use.');
    if (!existing) this.transaction(()=>{this.db.prepare('INSERT INTO runs(id,user_id,created_at,record) VALUES (?,?,?,?)').run(record.id, actor.id, record.at, JSON.stringify(record));if(report)this.writeReport(record.id,report);});
    return { saved: true, duplicate: Boolean(existing) };
  }
  metadata(input) {
    const title = cleanText(input.title, 120, 'song title'), fileName = cleanText(input.fileName, 180, 'MIDI filename');
    if (!/\.midi?$/i.test(fileName)) throw new SchoolError(400, 'Choose a standard MIDI file.');
    if (!Number.isInteger(input.midiBytes) || input.midiBytes < 14 || input.midiBytes > 10 * 1024 * 1024 || !Number.isInteger(input.audioBytes) || input.audioBytes < 0 || input.audioBytes > 100 * 1024 * 1024) throw new SchoolError(400, 'MIDI files must be at most 10 MB and recordings at most 100 MB.');
    const audioName = input.audioBytes ? cleanText(input.audioName, 180, 'recording filename') : '';
    if (!Array.isArray(input.selected) || !input.selected.length && !(Array.isArray(input.parts) && input.parts.length && input.parts.every(part=>part?.instrument==='vocals')) || input.selected.length > 512 || !input.selected.every(id => typeof id === 'string' && /^\d{1,3}:\d{1,2}$/.test(id))) throw new SchoolError(400, 'Choose the instrument parts to publish.');
    if (!input.mapping || typeof input.mapping !== 'object' || Array.isArray(input.mapping) || Object.keys(input.mapping).length > 128 || !Object.entries(input.mapping).every(([pitch, drum]) => /^\d{1,3}$/.test(pitch) && Number(pitch) <= 127 && (drum === 'ignore' || DRUMS.some(item => item.id === drum)))) throw new SchoolError(400, 'Invalid drum assignments.');
    let alignment; try { alignment = validateAlignment(input.offset, input.timeScale); } catch (error) { throw new SchoolError(400, error.message); }
    if (!Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1) throw new SchoolError(400, 'Invalid recording volume.');
    let parts;
    try { parts = arrangementParts(input.parts, input.selected); } catch (error) { throw new SchoolError(400, error.message); }
    const lyrics = {};
    try {
      if(input.lyricsText !== undefined)lyrics.lyricsText=lyricText(input.lyricsText);
      if(input.lyricsClock !== undefined) { if(!['midi','recording'].includes(input.lyricsClock))throw new Error('Choose MIDI or recording for the lyric clock.');lyrics.lyricsClock=input.lyricsClock; }
      if(input.lyricsOffset !== undefined) {if(!Number.isFinite(input.lyricsOffset)||Math.abs(input.lyricsOffset)>300)throw new Error('Choose a lyric adjustment within 300 seconds.');lyrics.lyricsOffset=input.lyricsOffset;}
    } catch(error){throw new SchoolError(400,error.message);}
    return { title, fileName, audioName, selected: [...new Set(input.selected)], mapping: { ...input.mapping }, ...alignment, volume: input.volume, ...lyrics, ...(input.parts ? { arrangementVersion: 1, parts } : {}) };
  }
  canManageSong(actor, song) { return isStaff(actor) && (actor.role === 'owner' || song.teacher_id === actor.id); }
  beginUpload(actor, input) {
    this.requireStaff(actor); const meta = this.metadata(input);
    let song = input.songId ? this.db.prepare('SELECT * FROM songs WHERE id=?').get(input.songId) : null;
    if (input.songId && (!song || !this.canManageSong(actor, song))) throw new SchoolError(404, 'Song not found.');
    if (song && song.revision_id !== input.revisionId) throw new SchoolError(409, 'This song has changed. Reload it from the school library before updating.');
    const used = this.db.prepare('SELECT COALESCE(SUM(midi_expected+audio_expected),0) AS n FROM revisions').get().n;
    if (used + input.midiBytes + input.audioBytes > this.storageLimit) throw new SchoolError(413, 'School song storage is full. Ask the school owner to review storage capacity.');
    if (this.db.prepare("SELECT COUNT(*) AS n FROM revisions WHERE teacher_id=? AND state='draft'").get(actor.id).n >= 5) throw new SchoolError(409, 'Finish or cancel the current song uploads before starting another.');
    const id = randomUUID(), songId = song?.id || randomUUID();
    this.transaction(() => {
      if (!song) this.db.prepare('INSERT INTO songs(id,teacher_id,updated_at) VALUES (?,?,?)').run(songId, actor.id, this.now());
      this.db.prepare('INSERT INTO revisions(id,song_id,teacher_id,base_revision,metadata,midi_expected,audio_expected,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, songId, actor.id, song?.revision_id ?? null, JSON.stringify(meta), input.midiBytes, input.audioBytes, this.now());
    });
    return { uploadId: id, songId };
  }
  musicPath(id, kind) { if (!uuidPattern.test(id) || !['midi', 'audio'].includes(kind)) throw new SchoolError(404, 'File not found.'); return path.join(this.directory, 'music', `${id}.${kind}`); }
  draft(actor, id) { const row = this.db.prepare("SELECT * FROM revisions WHERE id=? AND state='draft' AND teacher_id=?").get(id, actor.id); if (!row) throw new SchoolError(404, 'Upload not found.'); return row; }
  async receiveFile(actor, id, kind, request) {
    this.requireStaff(actor); const row = this.draft(actor, id), expected = kind === 'midi' ? row.midi_expected : kind === 'audio' ? row.audio_expected : 0;
    if (!expected) throw new SchoolError(400, 'This upload does not include that file.');
    if (request.headers['content-length'] && Number(request.headers['content-length']) !== expected) throw new SchoolError(400, 'The upload size does not match the selected file.');
    const key = `${id}:${kind}`;
    if (this.uploading.has(key) || this.publishing.has(id)) throw new SchoolError(409, 'That file is already uploading or being published.');
    this.uploading.add(key);
    const destination = this.musicPath(id, kind), temporary = `${destination}.${randomBytes(8).toString('hex')}.part`;
    let handle, complete = false, bytes = 0;
    try {
      handle = await open(temporary, 'wx', 0o600);
      for await (const chunk of request) { bytes += chunk.length; if (bytes > expected) throw new SchoolError(413, 'The uploaded file is larger than expected.'); await handle.writeFile(chunk); }
      if (bytes !== expected) throw new SchoolError(400, 'The upload was interrupted. Try again.');
      await handle.sync(); await handle.close(); handle = null;
      this.draft(actor, id);
      await rename(temporary, destination);
      this.db.prepare(kind === 'midi' ? 'UPDATE revisions SET midi_received=? WHERE id=?' : 'UPDATE revisions SET audio_received=? WHERE id=?').run(bytes, id);
      complete = true;
    } finally { await handle?.close().catch(() => {}); if (!complete) await unlink(temporary).catch(() => {}); this.uploading.delete(key); }
  }
  async publish(actor, id) {
    if (this.publishing.has(id)) throw new SchoolError(409, 'This song is already being published.');
    this.publishing.add(id);
    try {
    this.requireStaff(actor); const row = this.draft(actor, id);
    if (row.midi_received !== row.midi_expected || row.audio_received !== row.audio_expected || this.uploading.has(`${id}:midi`) || this.uploading.has(`${id}:audio`)) throw new SchoolError(409, 'Wait for both music files to finish uploading.');
    const meta = JSON.parse(row.metadata), bytes = await readFile(this.musicPath(id, 'midi'));
    const song = parseMidiSong(bytes, meta.fileName);
    const arrangement = importedArrangement(song, meta), chart = (arrangement.parts.find(part => part.instrument === 'drums') || arrangement.parts[0]).chart;
    meta.parts = arrangement.parts.map(({ id, instrument, name, selected }) => ({ id, instrument, name, selected }));
    meta.arrangementVersion = 1;
    Object.assign(meta, { fingerprint: song.fingerprint, notes: chart.notes.length || chart.lyrics?.length || 0, duration: chart.duration, bpm: chart.bpm, bytes: row.midi_expected + row.audio_expected });
    this.transaction(() => {
      const current = this.db.prepare('SELECT * FROM songs WHERE id=?').get(row.song_id);
      if (!current || !this.canManageSong(actor, current) || current.revision_id !== row.base_revision) throw new SchoolError(409, 'The song changed during upload. Reload it and try again.');
      this.db.prepare("UPDATE revisions SET metadata=?,state='published' WHERE id=?").run(JSON.stringify(meta), id);
      this.db.prepare('UPDATE songs SET revision_id=?,archived=0,updated_at=? WHERE id=?').run(id, this.now(), row.song_id);
      this.audit(actor, 'song.publish', row.song_id);
    });
    return this.getSong(actor, row.song_id);
    } finally { this.publishing.delete(id); }
  }
  async discard(actor, id) {
    const row = this.draft(actor, id);
    if (this.uploading.has(`${id}:midi`) || this.uploading.has(`${id}:audio`) || this.publishing.has(id)) throw new SchoolError(409, 'Stop the upload before cancelling it.');
    for (const kind of ['midi', 'audio']) await unlink(this.musicPath(id, kind)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    this.transaction(() => { this.db.prepare('DELETE FROM revisions WHERE id=?').run(id); this.db.prepare('DELETE FROM songs WHERE id=? AND revision_id IS NULL AND NOT EXISTS(SELECT 1 FROM revisions WHERE song_id=?)').run(row.song_id, row.song_id); });
  }
  async cleanDrafts() {
    const rows = this.db.prepare("SELECT * FROM revisions WHERE state='draft' AND created_at<?").all(this.now() - 24 * 60 * 60 * 1000);
    for (const row of rows) await this.discard({ id: row.teacher_id }, row.id);
  }
  songRow(id) { return this.db.prepare("SELECT s.*,r.metadata,r.id AS revision FROM songs s JOIN revisions r ON r.id=s.revision_id WHERE s.id=? AND r.state='published'").get(id); }
  getSong(actor, id, revisionId) {
    const row = this.songRow(id);
    if (!row || (row.archived && !this.canManageSong(actor, row))) throw new SchoolError(404, 'Song not found.');
    const revision=revisionId ? this.db.prepare("SELECT id,metadata FROM revisions WHERE id=? AND song_id=? AND state='published'").get(revisionId,id) : {id:row.revision,metadata:row.metadata};
    if(!revision)throw new SchoolError(404,'Song version not found.');
    return { ...JSON.parse(revision.metadata), id: row.id, revisionId: revision.id, ownerId: row.teacher_id, ownerName: this.user(row.teacher_id)?.name ?? 'Teacher', canManage: this.canManageSong(actor, row), archived: Boolean(row.archived), savedAt: row.updated_at };
  }
  listSongs(actor, archived = false) {
    if (archived) this.requireStaff(actor);
    const ids = archived ? (actor.role === 'owner' ? this.db.prepare('SELECT id FROM songs WHERE archived=1 AND revision_id IS NOT NULL ORDER BY updated_at DESC').all() : this.db.prepare('SELECT id FROM songs WHERE archived=1 AND teacher_id=? AND revision_id IS NOT NULL ORDER BY updated_at DESC').all(actor.id)) : this.db.prepare('SELECT id FROM songs WHERE archived=0 AND revision_id IS NOT NULL ORDER BY updated_at DESC').all();
    return ids.map(row => this.getSong(actor, row.id));
  }
  archiveSong(actor, id, archived) {
    this.requireStaff(actor); const row = this.songRow(id);
    if (!row || !this.canManageSong(actor, row)) throw new SchoolError(404, 'Song not found.');
    if (typeof archived !== 'boolean') throw new SchoolError(400, 'Choose whether this song is archived.');
    this.db.prepare('UPDATE songs SET archived=?,updated_at=? WHERE id=?').run(archived ? 1 : 0, this.now(), id); this.audit(actor, archived ? 'song.archive' : 'song.restore', id);
  }
  async sendFile(actor, songId, revisionId, kind, request, response) {
    const meta = this.getSong(actor, songId, revisionId);
    const file = this.musicPath(revisionId, kind);
    let info; try { info = await stat(file); } catch (error) { if (error.code === 'ENOENT') throw new SchoolError(404, 'Recording not found.'); throw error; }
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': info.size, 'Content-Disposition': `attachment; filename="${songId}.${kind === 'midi' ? 'mid' : 'audio'}"` });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(file); response.on('close', () => stream.destroy()); stream.on('error', () => response.destroy()); stream.pipe(response);
  }
}

export function validateSchoolRun(input) {
  if (!input || !uuidPattern.test(input.id) || !['builtin', 'school', 'personal'].includes(input.sourceKind) || typeof input.sourceId !== 'string' || input.sourceId.length > 120) throw new SchoolError(400, 'Invalid practice result.');
  const integers = { hits: [0, 50000], total: [1, 50000], extras: [0, 100000], bestStreak: [0, 50000], repeats: [1, 8] };
  for (const [field, [min, max]] of Object.entries(integers)) if (!Number.isInteger(input[field]) || input[field] < min || input[field] > max) throw new SchoolError(400, `Invalid practice ${field}.`);
  if (input.hits > input.total || input.bestStreak > input.hits || ![1, 2, 4, 8].includes(input.repeats) || ![70, 100, 140].includes(input.tolerance) || !['all', 'kick', 'snare', 'cymbals', 'toms'].includes(input.focus)) throw new SchoolError(400, 'Invalid practice totals or settings.');
  for (const field of ['bpm', 'endBpm']) if (!Number.isFinite(input[field]) || input[field] < 5 || input[field] > 1200) throw new SchoolError(400, 'Invalid practice tempo.');
  for (const field of ['meanMs', 'meanAbsMs']) if (input.hits ? !Number.isFinite(input[field]) || Math.abs(input[field]) > input.tolerance : input[field] !== null) throw new SchoolError(400, 'Invalid practice timing.');
  if (input.meanAbsMs < 0 || (input.hits && Math.abs(input.meanMs) > input.meanAbsMs + 0.0001)) throw new SchoolError(400, 'Invalid average timing.');
  if (typeof input.section !== 'string' || !/^\d{1,5}–\d{1,5}$/.test(input.section) || typeof input.full !== 'boolean') throw new SchoolError(400, 'Invalid practice section.');
  const [firstBar, lastBar] = input.section.split('–').map(Number);
  if (firstBar < 1 || lastBar < firstBar) throw new SchoolError(400, 'Invalid practice section.');
  const title = cleanText(input.title, 120, 'practice title');
  if (input.sourceKind === 'school' && (!uuidPattern.test(input.sourceId) || !uuidPattern.test(input.revisionId))) throw new SchoolError(400, 'Invalid school song reference.');
  const drums = Array.isArray(input.drums) ? input.drums : [];
  if (drums.some(item => !item || typeof item !== 'object')) throw new SchoolError(400, 'Invalid drum timing breakdown.');
  if (!drums.length || drums.length > 8 || new Set(drums.map(item => item.id)).size !== drums.length || drums.some(item => !DRUMS.some(drum => drum.id === item.id) || !Number.isInteger(item.total) || item.total < 1 || !Number.isInteger(item.hits) || item.hits < 0 || item.hits > item.total || (item.hits ? !Number.isFinite(item.meanMs) || !Number.isFinite(item.meanAbsMs) || item.meanAbsMs < 0 || item.meanAbsMs > input.tolerance || Math.abs(item.meanMs) > item.meanAbsMs + 0.0001 : item.meanMs !== null || item.meanAbsMs !== null))) throw new SchoolError(400, 'Invalid drum timing breakdown.');
  if (drums.reduce((sum, drum) => sum + drum.total, 0) !== input.total || drums.reduce((sum, drum) => sum + drum.hits, 0) !== input.hits) throw new SchoolError(400, 'The drum totals do not match the result.');
  return { id: input.id, sourceKind: input.sourceKind, sourceId: input.sourceId, revisionId: input.sourceKind === 'school' ? input.revisionId : null, title, grooveId: null, hits: input.hits, total: input.total, extras: input.extras, bestStreak: input.bestStreak, accuracy: input.hits / (input.total + input.extras) * 100, meanMs: input.meanMs, meanAbsMs: input.meanAbsMs, bpm: input.bpm, endBpm: input.endBpm, tolerance: input.tolerance, focus: input.focus, section: input.section, full: input.full, repeats: input.repeats, drums: drums.map(({ id, hits, total, meanMs, meanAbsMs }) => ({ id, hits, total, meanMs, meanAbsMs })) };
}

export class ClassroomApi {
  constructor(store, options = {}) { this.store = store; this.options = options; this.limits = new Map(); }
  limit(key, maximum, window = 15 * 60 * 1000) {
    const now = this.store.now(); let item = this.limits.get(key);
    if (!item || item.until <= now) { item = { count: 0, until: now + window }; this.limits.set(key, item); }
    if (++item.count > maximum) throw new SchoolError(429, 'Too many attempts. Please try again later.');
    if (this.limits.size > 5000) for (const [id, value] of this.limits) if (value.until <= now) this.limits.delete(id);
    if (this.limits.size > 10000) this.limits.delete(this.limits.keys().next().value);
  }
  cookie(response, token) { response.setHeader('Set-Cookie', `${this.options.secureCookies === false ? 'groove_session' : '__Host-groove_session'}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 8 * 60 * 60 : 0}${this.options.secureCookies === false ? '' : '; Secure'}`); }
  readSession(request) { const name = this.options.secureCookies === false ? 'groove_session' : '__Host-groove_session'; const cookie = String(request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`)); return this.store.session(cookie?.slice(name.length + 1)); }
  origin(request) {
    if (this.options.localSetup && !this.options.publicOrigin && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host || '')) throw new SchoolError(403, 'Use localhost for the development app.');
    const expected = this.options.publicOrigin || (this.options.localSetup ? `http://${request.headers.host}` : '');
    if (!expected || request.headers.origin !== expected || request.headers['sec-fetch-site'] === 'cross-site') throw new SchoolError(403, 'Open Groove Lab at its school website and try again.');
  }
  async json(request, maximum = 32768) {
    if (!String(request.headers['content-type'] || '').startsWith('application/json')) throw new SchoolError(415, 'Send JSON for this request.');
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > maximum) throw new SchoolError(413, 'This request is too large.'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new SchoolError(400, 'Invalid JSON request.'); }
  }
  async handle(request, response, url) {
    if (!url.pathname.startsWith('/api/')) return false;
    response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('Vary', 'Cookie');
    const send = (status, data) => { const body = JSON.stringify(data); response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }); response.end(request.method === 'HEAD' ? undefined : body); };
    try {
      const method = request.method, pathname = url.pathname, session = this.readSession(request);
      if (pathname === '/api/session' && method === 'GET') { send(200, { enabled: true, schoolId: this.store.setting('school_id'), schoolName: this.store.setting('school_name', 'School library'), setupNeeded: !this.store.hasOwner(), setupTokenRequired: !this.options.localSetup, user: session?.user ?? null, csrf: session?.csrf ?? null }); return true; }
      if (!['GET', 'HEAD'].includes(method)) this.origin(request);
      if (['/api/login', '/api/setup'].includes(pathname) && method === 'POST') {
        const input = await this.json(request), ip = request.socket.remoteAddress || 'unknown';
        const username = String(input.username || '').trim().toLowerCase().slice(0, 40);
        const passwordVersion = this.store.db.prepare('SELECT password_hash FROM users WHERE username=?').get(username)?.password_hash.slice(-16) || 'unknown';
        this.limit(`auth-ip:${ip}`, 240); this.limit(`auth-user:${username}:${passwordVersion}`, 10); this.limit('auth-global', 240, 60000);
        let result;
        if (pathname === '/api/setup') {
          if (!this.options.localSetup && (!this.options.setupToken || !safeEqual(input.setupToken, this.options.setupToken))) throw new SchoolError(403, 'The school setup key is incorrect.');
          result = await this.store.setup(input);
        } else result = await this.store.login(input);
        this.cookie(response, result.token); send(200, { user: result.user, csrf: result.csrf }); return true;
      }
      if (!session) throw new SchoolError(401, 'Sign in to your school account.');
      const actor = session.user;
      if (!['GET', 'HEAD'].includes(method) && !safeEqual(String(request.headers['x-csrf-token'] || ''), session.csrf)) throw new SchoolError(403, 'Your sign-in changed. Refresh the page and try again.');
      if (pathname === '/api/logout' && method === 'POST') { this.store.db.prepare('DELETE FROM sessions WHERE hash=?').run(session.hash); this.cookie(response, ''); send(200, { signedOut: true }); return true; }
      if (pathname === '/api/password' && method === 'POST') { const result = await this.store.changePassword(actor, await this.json(request)); this.cookie(response, result.token); send(200, { user: result.user, csrf: result.csrf }); return true; }
      if (actor.mustChangePassword) throw new SchoolError(428, 'Choose your own password before continuing.');
      if (pathname.startsWith('/api/band/') && this.band) { return await this.band.handle(request, response, url, actor, send); }
      if (pathname === '/api/storage' && method === 'GET') {
        if (actor.role !== 'owner') throw new SchoolError(403, 'Only the school owner can view storage details.');
        const storage = this.options.storage;
        send(200, { schoolId: this.store.setting('school_id'), directory: this.store.directory, volumeVerified: storage?.volumeVerified === true, local: this.options.localSetup === true, newSchoolAllowed: storage?.newSchoolAllowed === true, snapshot: storage?.snapshot ?? null, accounts: this.store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n, songs: this.store.db.prepare('SELECT COUNT(*) AS n FROM songs WHERE revision_id IS NOT NULL').get().n, attempts: this.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n }); return true;
      }
      if (pathname === '/api/users' && method === 'GET') { send(200, { users: this.store.roster(actor) }); return true; }
      if (pathname === '/api/users' && method === 'POST') { this.limit(`create:${actor.id}`, 100, 60 * 60 * 1000); send(201, await this.store.createUser(actor, await this.json(request))); return true; }
      const reportRoute=pathname.match(/^\/api\/users\/([0-9a-f-]+)\/runs\/([0-9a-f-]+)$/);
      if(reportRoute && method==='GET'){send(200,this.store.runReport(actor,reportRoute[1],reportRoute[2]));return true;}
      let match = pathname.match(/^\/api\/users\/([0-9a-f-]+)\/(reset-password|active|progress|instrument)$/);
      if (match) {
        const [, id, action] = match;
        if (action === 'instrument' && method === 'POST') { send(200, { user: this.store.setInstrument(actor, id, (await this.json(request)).defaultInstrument) }); return true; }
        if (action === 'progress' && method === 'GET') { send(200, this.store.progress(actor, id, url.searchParams.get('cursor'))); return true; }
        if (action === 'reset-password' && method === 'POST') { this.limit(`reset:${actor.id}`, 50, 60 * 60 * 1000); send(200, await this.store.resetPassword(actor, id, await this.json(request))); return true; }
        if (action === 'active' && method === 'POST') { send(200, { user: this.store.setActive(actor, id, (await this.json(request)).active) }); return true; }
      }
      if (pathname === '/api/runs' && method === 'POST') { this.limit(`runs:${actor.id}`, 240, 60 * 60 * 1000); send(200, this.store.saveRun(actor, await this.json(request, 8*1024*1024))); return true; }
      if (pathname === '/api/library' && method === 'GET') {
        const songs = this.store.listSongs(actor, url.searchParams.get('archived') === 'true');
        const resolved = []; for (const song of songs) resolved.push(this.band ? await this.band.librarySong(actor, song) : song);
        send(200, { songs: resolved }); return true;
      }
      if (pathname === '/api/library/uploads' && method === 'POST') { this.limit(`uploads:${actor.id}`, 100, 60 * 60 * 1000); this.store.requireStaff(actor); await this.store.cleanDrafts(); send(201, this.store.beginUpload(actor, await this.json(request))); return true; }
      match = pathname.match(/^\/api\/library\/uploads\/([0-9a-f-]+)(?:\/(midi|audio|publish))?$/);
      if (match) {
        const [, id, action] = match;
        if (['midi', 'audio'].includes(action) && method === 'PUT') { await this.store.receiveFile(actor, id, action, request); send(200, { uploaded: true }); return true; }
        if (action === 'publish' && method === 'POST') { try { send(200, { song: await this.store.publish(actor, id) }); } catch (error) { if (!error.status && error.code?.startsWith('SQLITE')) throw error; if (!error.status) throw new SchoolError(400, String(error.message).slice(0, 240)); throw error; } return true; }
        if (!action && method === 'DELETE') { await this.store.discard(actor, id); send(200, { discarded: true }); return true; }
      }
      match = pathname.match(/^\/api\/library\/([0-9a-f-]+)(?:\/(archive|revisions\/([0-9a-f-]+)\/(midi|audio)))?$/);
      if (match) {
        const [, id, action, revision, kind] = match;
        if (!action && method === 'GET') { const song = this.store.getSong(actor, id, url.searchParams.get('revision')); send(200, { song: this.band ? await this.band.librarySong(actor, song) : song }); return true; }
        if (action === 'archive' && method === 'POST') { this.store.archiveSong(actor, id, (await this.json(request)).archived); send(200, { updated: true }); return true; }
        if (revision && ['GET', 'HEAD'].includes(method)) { await this.store.sendFile(actor, id, revision, kind, request, response); return true; }
      }
      throw new SchoolError(404, 'School action not found.');
    } catch (error) { if (!response.headersSent) send(error.status || 500, { error: error.status ? error.message : 'The school service could not complete this request. Try again.' }); else response.destroy(); }
    return true;
  }
}
