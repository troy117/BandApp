import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { builtinArrangement, DUETS, importedArrangement, arrangementParts } from '../dist/arrangements.mjs';
import { parseMidiSong } from '../dist/midi.mjs';
import { bandRecord, validatePartResult } from './band-results.mjs';
import { followInstrument } from '../dist/follow-along.mjs';

const bandError = (status, message) => Object.assign(new Error(message), { status });
const staffMember = actor => ['teacher', 'owner'].includes(actor.role);
const runningRoom = room => room.state === 'playing';
const descriptor = arrangement => ({ id: arrangement.id, revisionId: arrangement.revisionId, sourceKind: arrangement.sourceKind, title: arrangement.title, duration: arrangement.duration, bpm: arrangement.bpm, parts: arrangement.parts.map(part => ({ id: part.id, name: part.name, instrument: part.instrument, total: part.chart.notes.length })) });

export class BandSessions {
  constructor(api, { clock = () => performance.now() } = {}) {
    this.api = api; this.store = api.store; this.clock = clock; this.rooms = new Map(); this.cache = new Map(); this.sockets = new Set(); api.band = this;
    // A previous process cannot resume an audible take. Preserve its reports with an honest state.
    this.store.db.prepare("UPDATE band_takes SET state='interrupted' WHERE state='playing'").run();
    this.store.db.prepare("UPDATE band_results SET state='interrupted' WHERE state='playing'").run();
  }
  async arrangement(actor, kind, id, revisionId) {
    if (kind === 'duet') {
      if (typeof id !== 'string' || !DUETS.some(song => song.id === id)) throw bandError(400, 'Choose a provided duet.');
      return builtinArrangement(id);
    }
    if (kind !== 'school') throw bandError(400, 'Choose a provided duet or published school song.');
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id) || revisionId && (typeof revisionId !== 'string' || !/^[0-9a-f-]{36}$/.test(revisionId))) throw bandError(400, 'Choose a valid published song version.');
    const visible = this.store.getSong(actor, id), revision = revisionId || visible.revisionId;
    const row = this.store.db.prepare("SELECT metadata FROM revisions WHERE id=? AND song_id=? AND state='published'").get(revision, id);
    if (!row) throw bandError(404, 'Song version not found.');
    const key = id + ':' + revision;
    if (this.cache.has(key)) return this.cache.get(key);
    const meta = { ...JSON.parse(row.metadata), id, revisionId: revision };
    const midi = parseMidiSong(await readFile(this.store.musicPath(revision, 'midi')), meta.fileName);
    const arrangement = importedArrangement(midi, meta);
    arrangement.audio = meta.audioName ? { route: '/library/' + id + '/revisions/' + revision + '/audio', offset: meta.offset, volume: meta.volume, name: meta.audioName } : null;
    this.cache.set(key, arrangement);
    if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value);
    return arrangement;
  }
  async librarySong(actor, song) {
    if (song.parts !== undefined) return song;
    try {
      const arrangement = await this.arrangement(actor, 'school', song.id, song.revisionId);
      return { ...song, arrangementVersion: 1, parts: arrangement.parts.map(({ id, instrument, name, selected }) => ({ id, instrument, name, selected })) };
    } catch {
      // A damaged or unavailable MIDI must not hide the rest of the library.
      // Loading that individual arrangement still reports its error normally.
      return song;
    }
  }
  room(actor, id) {
    const room = this.rooms.get(id);
    if (!room || (room.teacherId !== actor.id && !room.participants.some(person => person.userId === actor.id)) || !this.eligible(room, actor.id)) throw bandError(404, 'Session not found.');
    return room;
  }
  teacher(actor, room) { if (room.teacherId !== actor.id || !staffMember(actor)) throw bandError(403, 'Only this session’s teacher can control it.'); }
  snapshot(room, actor) {
    const teacher = room.teacherId === actor.id;
    return { id: room.id, version: room.version, state: room.state, teacherId: room.teacherId, teacherName: room.teacherName, teacherConnected: Boolean(room.teacherSocket), teacherReady: room.teacherReady, arrangement: descriptor(room.arrangement), takeId: room.takeId, startAt: room.startAt, countInAt: room.countInAt, reason: room.reason || '', participants: room.participants.filter(p => teacher || p.userId === actor.id).map(p => ({ userId: p.userId, name: p.name, partId: p.partId, instrument: p.instrument, connected: Boolean(p.socket), ready: p.ready, state: p.state, input: p.input || '', progress: p.progress || null, result: p.result || null, message: p.message || '' })) };
  }
  send(socket, data) { if (socket?.readyState === 1) { if (socket.bufferedAmount > 256000) { socket.close(1013, 'Connection too slow'); return; } socket.send(JSON.stringify(data)); } }
  broadcast(room) {
    for (const socket of this.sockets) if (socket.roomId === room.id && socket.actor) this.send(socket, { type: 'room', room: this.snapshot(room, socket.actor) });
  }
  async handle(request, response, url, actor, send) {
    const path = url.pathname.slice('/api/band/'.length), method = request.method;
    if (path === 'catalog' && method === 'GET') {
      const songs = [];
      for (const stored of this.store.listSongs(actor)) {
        const song = await this.librarySong(actor, stored);
        songs.push({ id: song.id, revisionId: song.revisionId, sourceKind: 'school', title: song.title, parts: arrangementParts(song.parts, song.selected) });
      }
      send(200, { songs: [...DUETS.map(song => descriptor(builtinArrangement(song.id))), ...songs] }); return true;
    }
    if (path === 'takes' && method === 'GET') {
      this.store.requireStaff(actor);
      const rows = this.store.db.prepare('SELECT * FROM band_takes WHERE teacher_id=? ORDER BY created_at DESC,id DESC LIMIT 20').all(actor.id);
      send(200, { takes: rows.map(row => ({ id: row.id, at: row.created_at, state: row.state, arrangement: JSON.parse(row.record), results: this.store.db.prepare('SELECT user_id,state,record FROM band_results WHERE take_id=?').all(row.id).map(result => ({ userId: result.user_id, state: result.state, record: JSON.parse(result.record) })) })) }); return true;
    }
    let match = path.match(/^arrangements\/(duet|school)\/([a-z0-9-]+)$/);
    if (match && method === 'GET') { send(200, { arrangement: await this.arrangement(actor, match[1], match[2], url.searchParams.get('revision')) }); return true; }
    if (path === 'runs' && method === 'POST') {
      this.api.limit('band-runs:' + actor.id, 240, 3600000);
      const input = await this.api.json(request), arrangement = await this.arrangement(actor, input.sourceKind, input.sourceId, input.revisionId);
      const part = arrangement.parts.find(part => part.id === input.partId);
      if (!part || !/^[0-9a-f-]{36}$/.test(input.id || '')) throw bandError(400, 'Choose a valid part/result.');
      if(followInstrument(part.instrument))throw bandError(400,'Follow-along parts do not produce performance scores.');
      let summary; try { summary = validatePartResult(input.summary, part.chart.notes.length); } catch (error) { throw bandError(400, error.message); }
      const existing = this.store.db.prepare('SELECT user_id FROM runs WHERE id=?').get(input.id);
      if (existing && existing.user_id !== actor.id) throw bandError(409, 'Result identifier is already in use.');
      const record = bandRecord(arrangement, part, summary, { id: input.id, at: this.store.now() });
      if (!existing) this.store.db.prepare('INSERT INTO runs(id,user_id,created_at,record) VALUES (?,?,?,?)').run(record.id, actor.id, record.at, JSON.stringify(record));
      send(200, { saved: true, duplicate: Boolean(existing) }); return true;
    }
    if (path === 'rooms' && method === 'GET') {
      this.sweep();
      send(200, { rooms: [...this.rooms.values()].filter(room => room.state !== 'closed' && this.eligible(room, actor.id) && (room.teacherId === actor.id || room.participants.some(p => p.userId === actor.id))).map(room => this.snapshot(room, actor)) }); return true;
    }
    if (path === 'rooms' && method === 'POST') {
      this.store.requireStaff(actor); this.api.limit('rooms:' + actor.id, 30, 3600000);
      const input = await this.api.json(request);
      this.sweep();
      if (this.rooms.size >= 60 || [...this.rooms.values()].filter(room => room.teacherId === actor.id && room.state !== 'closed').length >= 3) throw bandError(409, 'Close an existing session before creating another.');
      const arrangement = await this.arrangement(actor, input.sourceKind, input.sourceId, input.revisionId);
      if (!Array.isArray(input.assignments) || input.assignments.length < 1 || input.assignments.length > 8 || new Set(input.assignments.map(p => p?.userId)).size !== input.assignments.length) throw bandError(400, 'Choose one to eight different students.');
      const participants = input.assignments.map(assignment => {
        const user = this.store.user(assignment?.userId), part = arrangement.parts.find(p => p.id === assignment?.partId);
        if (!user?.active || user.role !== 'student' || user.must_change || (actor.role !== 'owner' && user.teacher_id !== actor.id) || !part) throw bandError(400, 'Choose active students from your roster who can sign in, and valid song parts.');
        return { userId: user.id, name: user.name, partId: part.id, instrument: part.instrument, socket: null, ready: false, state: 'waiting', progress: null };
      });
      const room = { id: randomUUID(), version: randomUUID(), teacherId: actor.id, teacherName: actor.name, teacherSocket: null, teacherReady: false, arrangement, participants, state: 'preparing', createdAt: this.clock(), takeId: null, startAt: null, countInAt: null };
      this.rooms.set(room.id, room); send(201, { room: this.snapshot(room, actor) }); return true;
    }
    match = path.match(/^rooms\/([0-9a-f-]+)(?:\/(start|stop|close))?$/);
    if (match) {
      const room = this.room(actor, match[1]);
      if (!match[2] && method === 'GET') { send(200, { room: this.snapshot(room, actor) }); return true; }
      if (method !== 'POST') throw bandError(405, 'Use a session control.');
      this.teacher(actor, room); const input = await this.api.json(request);
      if (input.version !== room.version) throw bandError(409, 'The session changed. Refresh its state.');
      if (match[2] === 'start') {
        if (room.state !== 'preparing' || !room.teacherSocket || !room.teacherReady || room.participants.some(p => !p.socket || !p.ready || !this.eligible(room, p.userId))) throw bandError(409, 'All students and the teacher must be connected and Ready.');
        room.takeId = randomUUID(); room.state = 'playing'; room.version = randomUUID(); room.reason = '';
        const chart = room.arrangement.parts[0].chart;
        room.countInAt = this.clock() + 2200; room.startAt = room.countInAt + chart.countInBeats * chart.countInBeatSeconds * 1000;
        const take = { ...descriptor(room.arrangement), assignments: room.participants.map(p => ({ userId: p.userId, name: p.name, partId: p.partId, instrument: p.instrument })) };
        this.store.transaction(() => {
          this.store.db.prepare('INSERT INTO band_takes(id,teacher_id,created_at,state,record) VALUES (?,?,?,?,?)').run(room.takeId, actor.id, this.store.now(), 'playing', JSON.stringify(take));
          for (const p of room.participants) this.store.db.prepare('INSERT INTO band_results(take_id,user_id,state,record) VALUES (?,?,?,?)').run(room.takeId, p.userId, 'playing', JSON.stringify({ partId: p.partId }));
        });
        for (const p of room.participants) { p.state = 'playing'; p.ready = false; p.result = null; p.progress = null; p.message = ''; }
      } else if (match[2] === 'stop') {
        if (runningRoom(room)) this.interrupt(room, 'Teacher stopped the take.');
        room.state = 'preparing'; room.version = randomUUID(); room.startAt = null; room.countInAt = null; room.teacherReady = false;
        for (const p of room.participants) { p.ready = false; p.state = p.socket ? 'connected' : 'waiting'; }
      } else if (match[2] === 'close') { this.interrupt(room, 'Teacher closed the session.'); room.state = 'closed'; room.version = randomUUID(); }
      this.broadcast(room); send(200, { room: this.snapshot(room, actor) }); return true;
    }
    throw bandError(404, 'Band action not found.');
  }
  eligible(room, userId) {
    const user = this.store.user(userId), teacher = this.store.user(room.teacherId);
    return user?.active && !user.must_change && teacher?.active && !teacher.must_change && staffMember(teacher) && (userId === room.teacherId || (user.role === 'student' && (teacher.role === 'owner' || user.teacher_id === teacher.id)));
  }
  interrupt(room, reason) {
    if (runningRoom(room)) {
      this.store.db.prepare("UPDATE band_takes SET state='interrupted' WHERE id=?").run(room.takeId);
      this.store.db.prepare("UPDATE band_results SET state='interrupted' WHERE take_id=? AND state='playing'").run(room.takeId);
      for (const p of room.participants) if (p.state === 'playing') { p.state = 'interrupted'; p.message = reason; }
    }
    room.state = 'interrupted'; room.reason = reason; room.teacherReady = false;
    for (const p of room.participants) p.ready = false;
  }
  sweep() {
    for (const [id, room] of this.rooms) {
      if (this.clock() - room.createdAt > 2 * 3600000) { this.interrupt(room, 'Session expired.'); room.state = 'closed'; this.broadcast(room); }
      if (room.state === 'closed' && ![...this.sockets].some(socket => socket.roomId === id)) this.rooms.delete(id);
      else if (runningRoom(room) && this.clock() > room.startAt + room.arrangement.duration * 1000 + 15000) { this.interrupt(room, 'A result was not received.'); this.broadcast(room); }
    }
  }
  attach(server) {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
    server.on('upgrade', (request, socket, head) => {
      try {
        if (request.url !== '/api/band/socket') throw bandError(404, 'Not found');
        this.api.origin(request);
        const session = this.api.readSession(request);
        if (!session || session.user.mustChangePassword) throw bandError(401, 'Sign in first');
        this.wss.handleUpgrade(request, socket, head, ws => this.connect(ws, request, session));
      } catch (error) { socket.end('HTTP/1.1 ' + (error.status || 403) + ' Forbidden\r\nConnection: close\r\n\r\n'); }
    });
    this.timer = setInterval(() => {
      this.sweep();
      for (const socket of this.sockets) {
        const session = this.api.readSession(socket.request), room = this.rooms.get(socket.roomId);
        if (!session || (room && !this.eligible(room, session.user.id)) || (socket.authenticated && this.clock() - socket.lastSeen > 20000)) socket.close(1008, 'Sign in or reconnect');
      }
    }, 2000); this.timer.unref();
    server.on('close', () => this.close());
  }
  connect(socket, request, session) {
    socket.request = request; socket.actor = session.user; socket.authenticated = false; socket.lastSeen = this.clock(); this.sockets.add(socket);
    const timeout = setTimeout(() => { if (!socket.authenticated) socket.close(1008, 'Authentication required'); }, 5000); timeout.unref();
    socket.on('message', bytes => {
      try {
        const current = this.api.readSession(request);
        if (!current || current.user.mustChangePassword) throw bandError(401, 'Sign in again.');
        socket.actor = current.user;
        const message = JSON.parse(bytes.toString()); socket.lastSeen = this.clock();
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw bandError(400, 'Invalid session message.');
        this.api.limit('socket:' + current.user.id, 2400, 60000);
        if (!socket.authenticated) {
          if (message.type !== 'hello' || message.csrf !== current.csrf) throw bandError(403, 'Your sign-in changed. Refresh the page.');
          socket.authenticated = true; clearTimeout(timeout); this.send(socket, { type: 'hello' }); return;
        }
        if (message.type === 'ping') { if (typeof message.id !== 'string' || message.id.length > 80) return; this.send(socket, { type: 'pong', id: message.id, server: this.clock() }); return; }
        if (message.type === 'join') { this.join(socket, message); return; }
        if (message.type === 'leave') { this.detach(socket, 'Left the session.'); socket.roomId = null; return; }
        this.message(socket, message);
      } catch (error) { this.send(socket, { type: 'error', status: error.status || 500, message: error.status ? error.message : 'The session could not process this message.' }); if (!socket.authenticated || error.status === 401) socket.close(1008, 'Sign in again'); }
    });
    socket.on('close', () => { clearTimeout(timeout); this.detach(socket, 'Connection lost.'); this.sockets.delete(socket); });
    socket.on('error', () => {});
  }
  join(socket, message) {
    const room = this.room(socket.actor, message.roomId);
    if (room.state === 'closed' || !/^[a-zA-Z0-9-]{8,80}$/.test(message.clientId || '') || !this.eligible(room, socket.actor.id)) throw bandError(403, 'This session is unavailable.');
    const teacher = room.teacherId === socket.actor.id, p = room.participants.find(p => p.userId === socket.actor.id);
    const existing = teacher ? room.teacherSocket : p.socket;
    if (existing && existing !== socket && existing.readyState === 1) throw bandError(409, 'This account is already joined in another tab. Leave that tab first, or wait for its connection to close.');
    if (socket.roomId && socket.roomId !== room.id) this.detach(socket, 'Joined another session.');
    socket.roomId = room.id; socket.clientId = message.clientId;
    if (teacher) { room.teacherSocket = socket; room.teacherReady = false; } else { p.socket = socket; p.ready = false; if (!['playing', 'completed', 'interrupted'].includes(p.state)) p.state = 'connected'; }
    if (existing && existing !== socket) existing.close(1000, 'Reconnected');
    if (runningRoom(room)) {
      if (teacher) this.interrupt(room, 'Teacher reconnected. Prepare a fresh take.');
      else if (p.state === 'playing') this.interruptParticipant(room, p, 'Reconnect: wait for the next take.');
    }
    this.broadcast(room);
  }
  detach(socket, reason) {
    if (!socket.roomId) return;
    const room = this.rooms.get(socket.roomId); if (!room) return;
    if (room.teacherSocket === socket) { room.teacherSocket = null; room.teacherReady = false; if (runningRoom(room)) this.interrupt(room, 'Teacher connection lost. Start a fresh take.'); }
    const p = room.participants.find(p => p.socket === socket);
    if (p) { p.socket = null; p.ready = false; if (p.state === 'playing') this.interruptParticipant(room, p, reason); else if (p.state !== 'completed') p.state = 'disconnected'; }
    this.broadcast(room);
  }
  interruptParticipant(room, p, reason) {
    p.state = 'interrupted'; p.ready = false; p.message = reason;
    this.store.db.prepare("UPDATE band_results SET state='interrupted' WHERE take_id=? AND user_id=? AND state='playing'").run(room.takeId, p.userId);
    this.finishRoom(room);
  }
  finishRoom(room) {
    if (room.participants.every(p => ['completed', 'interrupted'].includes(p.state))) {
      room.state = room.participants.every(p => p.state === 'completed') ? 'completed' : 'interrupted';
      this.store.db.prepare('UPDATE band_takes SET state=? WHERE id=?').run(room.state, room.takeId);
    }
  }
  message(socket, message) {
    const room = this.room(socket.actor, socket.roomId);
    if (!this.eligible(room, socket.actor.id)) throw bandError(403, 'Your session assignment changed.');
    const teacher = room.teacherSocket === socket, p = room.participants.find(p => p.socket === socket);
    if (!teacher && !p) throw bandError(409, 'Join the session first.');
    if (message.type === 'ready') {
      if (room.state !== 'preparing' || message.version !== room.version || message.revisionId !== room.arrangement.revisionId) throw bandError(409, 'Prepare the current song version first.');
      const sync = message.sync;
      if (message.audio !== true || !sync || !Number.isInteger(sync.samples) || sync.samples < 3 || !Number.isFinite(sync.rttMs) || sync.rttMs < 0 || sync.rttMs > 300 || !Number.isFinite(sync.uncertaintyMs) || sync.uncertaintyMs < 0 || sync.uncertaintyMs > 100 || typeof message.input !== 'string' || !message.input.trim() || message.input.length > 100) throw bandError(400, 'Check audio, input and synchronization before Ready.');
      if (teacher) room.teacherReady = true;
      else { p.ready = true; p.state = 'ready'; p.input = message.input; }
      this.broadcast(room); return;
    }
    if (message.type === 'unready') { if (message.version !== room.version) throw bandError(409, 'The session changed.'); if (teacher) { room.teacherReady = false; if (runningRoom(room)) this.interrupt(room, String(message.reason || 'Teacher audio interrupted.').slice(0, 120)); } else { p.ready = false; if (p.state === 'playing') this.interruptParticipant(room, p, String(message.reason || 'Input interrupted.').slice(0, 120)); else if (room.state === 'preparing') p.state = 'connected'; } this.broadcast(room); return; }
    if (!p || message.takeId !== room.takeId) throw bandError(409, 'This take is no longer active.');
    if (message.type === 'finish' && p.state === 'completed') { this.send(socket, { type: 'saved', takeId: room.takeId }); return; }
    if (!runningRoom(room) || p.state !== 'playing') throw bandError(409, 'Wait for the next take.');
    if (message.type === 'interrupt') { this.interruptParticipant(room, p, String(message.reason || 'Practice interrupted.').slice(0, 120)); this.broadcast(room); return; }
    const part = room.arrangement.parts.find(part => part.id === p.partId);
    if(followInstrument(part.instrument)) {
      if(!message.summary || message.summary.mode !== 'follow' || ['accuracy','hits','misses','wrong'].some(key=>key in message.summary))throw bandError(400,'This part follows along without a performance score.');
      if(message.type === 'progress') {
        if(!Number.isFinite(message.position)||message.position<0||message.position>room.arrangement.duration+1)throw bandError(400,'Invalid follow-along position.');
        if(this.clock()-(p.lastProgress||0)<100)return;
        p.lastProgress=this.clock();p.progress={mode:'follow',position:message.position};this.broadcast(room);return;
      }
      if(message.type === 'finish') {
        if(this.clock()<room.startAt+room.arrangement.duration*1000-100)throw bandError(409,'The song has not finished.');
        const record={mode:'follow',partId:part.id,instrument:part.instrument,partName:part.name,at:this.store.now(),takeId:room.takeId};
        const updated=this.store.db.prepare("UPDATE band_results SET state='completed',record=? WHERE take_id=? AND user_id=? AND state='playing'").run(JSON.stringify(record),room.takeId,p.userId);
        if(updated.changes!==1)throw bandError(409,'This take was interrupted. Prepare a fresh take.');
        p.state='completed';p.result=record;this.finishRoom(room);this.send(socket,{type:'saved',takeId:room.takeId});this.broadcast(room);return;
      }
      throw bandError(400,'Unknown follow-along message.');
    }
    if (message.type === 'progress') {
      if (this.clock() - (p.lastProgress || 0) < 100) return;
      const value = message.summary;
      if (!value || !Number.isFinite(message.position) || message.position < 0 || message.position > room.arrangement.duration + 1 || !['hits', 'misses', 'wrong', 'extras', 'bestStreak'].every(key => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 250000) || value.hits + value.misses + value.wrong > part.chart.notes.length || value.bestStreak > value.hits || (value.hits ? !Number.isFinite(value.meanMs) || Math.abs(value.meanMs) > 140 : value.meanMs !== null)) throw bandError(400, 'Invalid progress.');
      p.lastProgress = this.clock(); p.progress = { position: message.position, hits: value.hits, misses: value.misses, wrong: value.wrong, extras: value.extras, bestStreak: value.bestStreak, meanMs: value.meanMs, accuracy: value.hits / Math.max(1, value.hits + value.misses + value.wrong + value.extras) * 100 };
      this.broadcast(room); return;
    }
    if (message.type === 'finish') {
      if (this.clock() < room.startAt + room.arrangement.duration * 1000 - 100) throw bandError(409, 'The song has not finished.');
      let summary; try { summary = validatePartResult(message.summary, part.chart.notes.length); } catch (error) { throw bandError(400, error.message); }
      const record = bandRecord(room.arrangement, part, summary, { takeId: room.takeId, at: this.store.now() });
      this.store.transaction(() => {
        const updated = this.store.db.prepare("UPDATE band_results SET state='completed',record=? WHERE take_id=? AND user_id=? AND state='playing'").run(JSON.stringify(record), room.takeId, p.userId);
        if (updated.changes !== 1) throw bandError(409, 'This take was interrupted. Prepare a fresh take.');
        this.store.db.prepare('INSERT INTO runs(id,user_id,created_at,record) VALUES (?,?,?,?)').run(record.id, p.userId, record.at, JSON.stringify(record));
      });
      p.state = 'completed'; p.result = summary; this.finishRoom(room); this.send(socket, { type: 'saved', takeId: room.takeId }); this.broadcast(room); return;
    }
    throw bandError(400, 'Unknown session message.');
  }
  close() {
    clearInterval(this.timer);
    for (const room of this.rooms.values()) if (runningRoom(room)) this.interrupt(room, 'Server restarted.');
    for (const socket of this.sockets) socket.terminate();
    this.wss?.close();
  }
}
