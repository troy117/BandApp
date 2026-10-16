// Original short example: a standard type-1 MIDI with a separate bass part,
// a tempo change at bar 3, and a matching synthesized, drumless WAV recording.
export function createDemoMidi() {
  const textBytes = text => [...new TextEncoder().encode(text)];
  const int16 = n => [n >>> 8 & 255, n & 255];
  const int32 = n => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
  const variable = value => { const out = [value & 127]; while ((value >>>= 7)) out.unshift((value & 127) | 128); return out; };
  const chunk = (name, bytes) => [...textBytes(name), ...int32(bytes.length), ...bytes];
  const meta = (type, bytes) => [255, type, ...variable(bytes.length), ...bytes];
  const track = events => {
    let previous = 0;
    const bytes = events.sort((a, b) => a.tick - b.tick).flatMap(event => { const delta = event.tick - previous; previous = event.tick; return [...variable(delta), ...event.data]; });
    return chunk('MTrk', bytes);
  };
  const end = { tick: 7680, data: meta(47, []) };
  const conductor = track([
    { tick: 0, data: meta(3, textBytes('Groove Lab sample')) },
    { tick: 0, data: meta(81, [7, 161, 32]) },
    { tick: 0, data: meta(88, [4, 2, 24, 8]) },
    { tick: 3840, data: meta(81, [9, 39, 192]) }, end,
  ]);
  const drums = [{ tick: 0, data: meta(3, textBytes('Drums')) }];
  const addNote = (events, tick, pitch, channel, length = 100) => {
    events.push({ tick, data: [144 + channel, pitch, 95] }, { tick: tick + length, data: [128 + channel, pitch, 0] });
  };
  for (let bar = 0; bar < 4; bar++) {
    for (let step = 0; step < 8; step++) {
      const tick = bar * 1920 + step * 240;
      if (bar === 3 && step >= 4) addNote(drums, tick, [48, 47, 45, 43][step - 4], 9);
      else addNote(drums, tick, 42, 9);
      if (step === 0 || step === 4) addNote(drums, tick, 36, 9);
      if (step === 2 || step === 6) addNote(drums, tick, 38, 9);
    }
  }
  addNote(drums, 0, 49, 9);
  addNote(drums, 5760, 51, 9);
  drums.push(end);
  const bass = [{ tick: 0, data: meta(3, textBytes('Bass (backing part)')) }];
  for (let beat = 0; beat < 16; beat++) addNote(bass, beat * 480, beat < 8 ? 40 : 45, 0, 360);
  bass.push(end);
  return new Uint8Array([...chunk('MThd', [...int16(1), ...int16(3), ...int16(480)]), ...conductor, ...track(drums), ...track(bass)]);
}
export function createDemoWav() {
  const sampleRate = 22050, duration = 8.8, samples = Math.round(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const data = new DataView(buffer);
  const writeText = (at, text) => { for (let i = 0; i < text.length; i++) data.setUint8(at + i, text.charCodeAt(i)); };
  writeText(0, 'RIFF'); data.setUint32(4, buffer.byteLength - 8, true); writeText(8, 'WAVE'); writeText(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true); data.setUint32(24, sampleRate, true); data.setUint32(28, sampleRate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
  writeText(36, 'data'); data.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const time = i / sampleRate;
    const beatLength = time < 4 ? 0.5 : 0.6;
    const beat = time < 4 ? time / 0.5 : 8 + (time - 4) / 0.6;
    const local = (beat % 1) * beatLength;
    const base = time < 4 ? 82.4069 : 110;
    const envelope = (1 - Math.exp(-local * 180)) * Math.exp(-local * 7);
    const bass = Math.sin(2 * Math.PI * base * local) * 0.33 + Math.sin(2 * Math.PI * base * 2 * local) * 0.08;
    const upper = Math.sin(2 * Math.PI * base * [4, 5, 6, 8][Math.floor(beat) % 4] * local) * 0.12;
    const value = Math.max(-1, Math.min(1, (bass + upper) * envelope * Math.min(1, (duration - time) * 12)));
    data.setInt16(44 + i * 2, value * 32767, true);
  }
  return buffer;
}
