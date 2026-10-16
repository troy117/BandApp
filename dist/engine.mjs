export const DRUMS = [
  { id: 'kick', name: 'Kick', short: 'KICK', color: '#63d9c4', keys: ['Space'], midi: [35, 36] },
  { id: 'snare', name: 'Snare', short: 'SNARE', color: '#f58c99', keys: ['KeyF', 'KeyG'], midi: [38, 40] },
  { id: 'hihat', name: 'Hi-hat', short: 'HI-HAT', color: '#f1cc75', keys: ['KeyD'], midi: [22, 26, 42, 44, 46] },
  { id: 'tom1', name: 'High tom', short: 'HIGH TOM', color: '#b5a0ed', keys: ['KeyJ'], midi: [48, 50] },
  { id: 'tom2', name: 'Mid tom', short: 'MID TOM', color: '#a0b6ed', keys: ['KeyK'], midi: [45, 47] },
  { id: 'tom3', name: 'Floor tom', short: 'FLOOR TOM', color: '#8ba1ca', keys: ['KeyL'], midi: [41, 43] },
  { id: 'crash', name: 'Crash', short: 'CRASH', color: '#e7a875', keys: ['KeyA'], midi: [49, 55, 57] },
  { id: 'ride', name: 'Ride', short: 'RIDE', color: '#9acc9a', keys: ['KeyS'], midi: [51, 53, 59] },
];
export const GROOVES = {
  rock: { name: 'First rock beat', description: 'Kick on 1 & 3. Snare on 2 & 4. Steady eighth-note hi-hats.', kick: [0, 4], snare: [2, 6], hihat: [0, 1, 2, 3, 4, 5, 6, 7] },
  floor: { name: 'Four on the floor', description: 'A kick on every beat, a backbeat on the snare, and eighth-note hi-hats.', kick: [0, 2, 4, 6], snare: [2, 6], hihat: [0, 1, 2, 3, 4, 5, 6, 7] },
  backbeat: { name: 'Build the backbeat', description: 'Start with two voices: kick on 1 & 3, snare on 2 & 4.', kick: [0, 4], snare: [2, 6], hihat: [] },
};
export const DEFAULT_BINDINGS = Object.fromEntries(DRUMS.map(drum => [drum.id, [...drum.keys]]));
export const RESERVED_KEYS = new Set(['Enter', 'Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
export function keyLabel(code) {
  if (code === 'Space') return 'Space';
  const punctuation = { BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Minus: '-', Equal: '=' };
  return punctuation[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace('Numpad', 'Num ');
}
const allowedKey = code => typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Space|Numpad[0-9]|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal)$/.test(code) && !RESERVED_KEYS.has(code);
export function validateBindings(input) {
  const seen = new Set();
  const output = {};
  for (const drum of DRUMS) {
    if (!Array.isArray(input?.[drum.id]) || input[drum.id].length > 4) return structuredClone(DEFAULT_BINDINGS);
    output[drum.id] = input[drum.id].filter(code => allowedKey(code) && !seen.has(code));
    output[drum.id].forEach(code => seen.add(code));
  }
  return output;
}
export function assignBinding(bindings, drumId, code, additional = false) {
  if (!DRUMS.some(drum => drum.id === drumId) || !allowedKey(code)) return { ok: false, reason: 'Choose a letter, number, Space, or punctuation key. Enter and Esc are playback controls.' };
  const owner = DRUMS.find(drum => drum.id !== drumId && bindings[drum.id].includes(code));
  if (owner) return { ok: false, reason: `${keyLabel(code)} is already assigned to ${owner.name}. Clear that assignment first.` };
  const next = structuredClone(bindings);
  next[drumId] = additional ? [...new Set([...next[drumId], code])].slice(-4) : [code];
  return { ok: true, bindings: next };
}
export function createChart(grooveId, bpm = 80, bars = 4) {
  const groove = GROOVES[grooveId];
  if (!groove || !Number.isFinite(bpm) || bpm < 40 || bpm > 200 || !Number.isInteger(bars) || bars < 1 || bars > 32) throw new Error('Invalid groove settings');
  const notes = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const drum of ['kick', 'snare', 'hihat']) {
      for (const step of groove[drum]) notes.push({ id: `${bar}-${drum}-${step}`, drum, bar: bar + 1, beat: step / 2 + 1, time: (bar * 4 + step / 2) * 60 / bpm, status: 'pending', errorMs: null, actualTime: null });
    }
  }
  notes.sort((a, b) => a.time - b.time);
  const beats = Array.from({ length: bars * 4 }, (_, beat) => ({ time: beat * 60 / bpm, bar: Math.floor(beat / 4) + 1, beat: beat % 4 + 1, downbeat: beat % 4 === 0 }));
  return { kind: 'groove', title: groove.name, notes, beats, bpm, bars, grooveId, duration: bars * 4 * 60 / bpm, countInBeats: 4, countInBeatSeconds: 60 / bpm, numerator: 4, denominator: 4 };
}
export function activeDrums(chart) { return DRUMS.filter(drum => chart.notes.some(note => note.drum === drum.id)); }
export function beatAtTime(chart, time) {
  let lo = 0, hi = chart.beats.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (chart.beats[mid].time <= time) lo = mid + 1; else hi = mid; }
  return chart.beats[Math.max(0, lo - 1)];
}
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export class Judge {
  constructor(chart, toleranceMs = 140) {
    this.chart = structuredClone(chart);
    this.toleranceMs = toleranceMs;
    this.extras = [];
    this.streak = 0;
    this.bestStreak = 0;
  }
  advance(time) {
    for (const note of this.chart.notes) {
      if (note.status === 'pending' && time - note.time > this.toleranceMs / 1000 + 1e-8) {
        note.status = 'miss';
        this.streak = 0;
      }
    }
  }
  strike(drum, time, source = 'keyboard') {
    this.advance(time);
    const candidates = this.chart.notes.filter(note => note.drum === drum && note.status === 'pending' && Math.abs(note.time - time) * 1000 <= this.toleranceMs + 1e-6);
    candidates.sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time));
    const note = candidates[0];
    if (!note) {
      const extra = { drum, time, source };
      this.extras.push(extra);
      this.streak = 0;
      return { type: 'extra', ...extra };
    }
    note.status = 'hit';
    note.actualTime = time;
    note.errorMs = (time - note.time) * 1000;
    note.source = source;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    return { type: 'hit', note, errorMs: note.errorMs };
  }
  summary() {
    const notes = this.chart.notes;
    const hits = notes.filter(note => note.status === 'hit');
    const errors = hits.map(note => note.errorMs);
    return {
      total: notes.length, hits: hits.length, misses: notes.filter(note => note.status === 'miss').length,
      pending: notes.filter(note => note.status === 'pending').length, extras: this.extras.length,
      accuracy: hits.length / (notes.length + this.extras.length) * 100,
      meanMs: average(errors), meanAbsMs: average(errors.map(Math.abs)), bestStreak: this.bestStreak,
      byDrum: DRUMS.filter(drum => notes.some(note => note.drum === drum.id)).map(drum => {
        const expected = notes.filter(note => note.drum === drum.id);
        const matched = expected.filter(note => note.status === 'hit');
        return { ...drum, total: expected.length, hits: matched.length, meanMs: average(matched.map(note => note.errorMs)), meanAbsMs: average(matched.map(note => Math.abs(note.errorMs))) };
      }),
    };
  }
}
export function performanceCsv(judge) {
  const rows = [['drum', 'bar', 'beat', 'expected_seconds', 'actual_seconds', 'timing_error_ms', 'result', 'input']];
  for (const note of judge.chart.notes) rows.push([note.drum, note.bar, note.beat, note.time.toFixed(4), note.actualTime?.toFixed(4) ?? '', note.errorMs?.toFixed(2) ?? '', note.status, note.source ?? '']);
  for (const extra of judge.extras) rows.push([extra.drum, '', '', '', extra.time.toFixed(4), '', 'extra', extra.source]);
  return rows.map(row => row.join(',')).join('\r\n');
}
