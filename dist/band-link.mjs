import { SessionClock } from './instruments.mjs';

export class BandLink {
  constructor(school, { onRoom, onState, onError, onSaved }) {
    Object.assign(this, { school, onRoom, onState, onError, onSaved }); this.socket = null; this.closed = true; this.roomId = null; this.pending = new Map(); this.clock = new SessionClock(); this.retry = 0;
    this.clientId = crypto.randomUUID();
  }
  join(id) {
    if (this.roomId === id && this.socket?.readyState === 1 && this.authenticated) { this.send({ type: 'join', roomId: id, clientId: this.clientId }); return; }
    this.leave(); this.roomId = id; this.closed = false; this.open();
  }
  open() {
    if (this.closed || !this.school.user) return;
    this.clock = new SessionClock(); this.pending.clear(); this.authenticated = false;
    const socket = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/band/socket'); this.socket = socket;
    this.onState('Connecting…');
    socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', csrf: this.school.csrf }));
    socket.onmessage = event => {
      if (this.socket !== socket) return;
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'hello') {
        this.authenticated = true; this.retry = 0;
        this.lastPong = performance.now();
        this.send({ type: 'join', roomId: this.roomId, clientId: this.clientId });
        this.ping(); let samples = 0; clearInterval(this.fastTimer);
        this.fastTimer = setInterval(() => { this.ping(); if (++samples >= 4) clearInterval(this.fastTimer); }, 180);
        clearInterval(this.pingTimer); this.pingTimer = setInterval(() => { if (performance.now() - this.lastPong > 12000) socket.close(1012, 'Timing connection stalled'); else this.ping(); }, 4000);
      } else if (message.type === 'pong') {
        const sent = this.pending.get(message.id); this.pending.delete(message.id);
        if (sent !== undefined && this.clock.add(sent, performance.now(), message.server)) this.lastPong = performance.now();
        this.onState(this.clock.status.ready ? 'Synchronized' : 'Measuring timing…', this.clock.status);
      } else if (message.type === 'room' && message.room?.id === this.roomId) this.onRoom(message.room);
      else if (message.type === 'saved') this.onSaved(message.takeId);
      else if (message.type === 'error') this.onError(message.message, message.status);
    };
    socket.onerror = () => {};
    socket.onclose = event => {
      if (this.socket !== socket) return;
      clearInterval(this.pingTimer); clearInterval(this.fastTimer); this.authenticated = false;
      this.onState(event.code === 1008 ? 'Sign in again, then rejoin the session.' : 'Connection lost. Reconnecting…');
      if (!this.closed && this.school.user && event.code !== 1008) this.retryTimer = setTimeout(() => this.open(), Math.min(5000, 500 * 2 ** this.retry++));
    };
  }
  send(message) { if (this.socket?.readyState !== 1 || !this.authenticated) return false; this.socket.send(JSON.stringify(message)); return true; }
  ping() { const id = crypto.randomUUID(); this.pending.set(id, performance.now()); if (this.pending.size > 20) this.pending.delete(this.pending.keys().next().value); this.send({ type: 'ping', id }); }
  leave() {
    this.closed = true; this.send({ type: 'leave' }); this.roomId = null;
    clearTimeout(this.retryTimer); clearInterval(this.pingTimer); clearInterval(this.fastTimer);
    const socket = this.socket; this.socket = null; this.authenticated = false; socket?.close(); this.pending.clear();
  }
}
