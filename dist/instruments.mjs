import { RESERVED_KEYS } from './engine.mjs';

export const KEYBOARD_PITCHES = Array.from({ length: 13 }, (_, index) => 60 + index);
export const DEFAULT_PIANO_BINDINGS = Object.fromEntries(KEYBOARD_PITCHES.map((pitch, i) => [pitch, ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK'][i]]));
export function pitchName(pitch) { return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pitch % 12] + (Math.floor(pitch / 12) - 1); }
export function pianoBindings(input) {
  const result = { ...DEFAULT_PIANO_BINDINGS }, used = new Set();
  for (const pitch of KEYBOARD_PITCHES) {
    const code = input?.[pitch];
    if (typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Space|Semicolon|Quote|Comma|Period|Slash|BracketLeft|BracketRight|Backslash|Minus|Equal)$/.test(code) && !used.has(code)) { result[pitch] = code; used.add(code); }
    else if (!used.has(result[pitch])) used.add(result[pitch]);
    else result[pitch] = '';
  }
  // A replacement can claim a later default key. Keep each key unambiguous.
  const seen = new Set();
  for (const pitch of KEYBOARD_PITCHES) { if (seen.has(result[pitch])) result[pitch] = ''; else if (result[pitch]) seen.add(result[pitch]); }
  return result;
}
export function bindPianoKey(bindings, pitch, code) {
  if (!KEYBOARD_PITCHES.includes(pitch) || RESERVED_KEYS.has(code) || !/^(Key[A-Z]|Digit[0-9]|Space|Semicolon|Quote|Comma|Period|Slash|BracketLeft|BracketRight|Backslash|Minus|Equal)$/.test(code)) throw new Error('Choose a letter, number, Space or punctuation key. Esc cancels.');
  if (Object.entries(bindings).some(([other, value]) => Number(other) !== pitch && value === code)) throw new Error('That key is already assigned. Choose another key.');
  return { ...bindings, [pitch]: code };
}
export function pitchedMidiMessage(event, now = () => performance.now()) {
  const data = event.data;
  if (!data || data.length !== 3 || ![...data].every(Number.isInteger) || data[0] < 0x80 || data[0] > 0x9f || data[1] < 0 || data[1] > 127 || data[2] < 0 || data[2] > 127) return null;
  return { type: data[0] >= 0x90 && data[2] > 0 ? 'on' : 'off', pitch: data[1], velocity: data[2] / 127, channel: (data[0] & 15) + 1, timestamp: Number.isFinite(event.timeStamp) && event.timeStamp >= 0 ? event.timeStamp : now() };
}

export class PitchJudge {
  constructor(chart, toleranceMs = 140) {
    this.chart = structuredClone(chart); this.toleranceMs = toleranceMs; this.extras = []; this.streak = 0; this.bestStreak = 0;
  }
  advance(time) {
    for (const note of this.chart.notes) if (note.status === 'pending' && time - note.time > this.toleranceMs / 1000 + 1e-8) { note.status = 'miss'; this.streak = 0; }
  }
  strike(pitch, time, source = 'keyboard') {
    this.advance(time);
    const nearby = this.chart.notes.filter(note => note.status === 'pending' && Math.abs(note.time - time) * 1000 <= this.toleranceMs + 1e-6).sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time));
    const correct = nearby.find(note => note.pitch === pitch);
    const note = correct || nearby[0];
    if (!note) { const extra = { pitch, time, source }; this.extras.push(extra); this.streak = 0; return { type: 'extra', ...extra }; }
    note.actualTime = time; note.errorMs = (time - note.time) * 1000; note.actualPitch = pitch; note.source = source;
    note.status = correct ? 'hit' : 'wrong';
    if (correct) { this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); }
    else this.streak = 0;
    return { type: note.status, note, errorMs: note.errorMs };
  }
  summary() {
    const notes = this.chart.notes, hits = notes.filter(note => note.status === 'hit'), wrong = notes.filter(note => note.status === 'wrong').length;
    return { total: notes.length, hits: hits.length, misses: notes.filter(note => note.status === 'miss').length, wrong, pending: notes.filter(note => note.status === 'pending').length, extras: this.extras.length, bestStreak: this.bestStreak, accuracy: hits.length / (notes.length + this.extras.length) * 100, meanMs: hits.length ? hits.reduce((n, note) => n + note.errorMs, 0) / hits.length : null, meanAbsMs: hits.length ? hits.reduce((n, note) => n + Math.abs(note.errorMs), 0) / hits.length : null };
  }
}

// Estimate a monotonic server clock from low round-trip samples. Never use this to grade input arrival.
export class SessionClock {
  constructor() { this.samples = []; }
  add(sent, received, server) {
    if (![sent, received, server].every(Number.isFinite) || received < sent || received - sent > 1500) return false;
    this.samples.push({ rtt: received - sent, offset: server - (sent + received) / 2 });
    this.samples = this.samples.slice(-12); return true;
  }
  get status() {
    const best = [...this.samples].sort((a, b) => a.rtt - b.rtt).slice(0, 3);
    if (!best.length) return { ready: false, samples: 0, rttMs: null, uncertaintyMs: null, offset: 0 };
    const offsets = best.map(s => s.offset).sort((a, b) => a - b), offset = offsets[Math.floor(offsets.length / 2)];
    const rttMs = best[0].rtt, uncertaintyMs = Math.max(rttMs / 2, offsets.at(-1) - offsets[0]);
    return { ready: this.samples.length >= 3 && rttMs <= 300 && uncertaintyMs <= 100, samples: this.samples.length, rttMs, uncertaintyMs, offset };
  }
  serverAt(local) { return local + this.status.offset; }
  localAt(server) { return server - this.status.offset; }
}
