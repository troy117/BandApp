// Original two-part MIDI: no school music or student data.
export function duetMidi() {
  const variable = value => { const result = [value & 127]; while ((value >>= 7)) result.unshift((value & 127) | 128); return result; };
  const u32 = value => [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255];
  const chunk = (name, bytes) => [...Buffer.from(name), ...u32(bytes.length), ...bytes];
  const drums = [0, 0xff, 3, 5, ...Buffer.from('Drums'), 0, 0xff, 0x51, 3, 7, 0xa1, 0x20, 0, 0x99, 36, 100, ...variable(240), 0x89, 36, 0, ...variable(240), 0x99, 38, 90, ...variable(240), 0x89, 38, 0, ...variable(240), 0xff, 0x2f, 0];
  const keys = [0, 0xff, 3, 4, ...Buffer.from('Keys'), 0, 0x90, 60, 95, ...variable(240), 0x80, 60, 0, ...variable(240), 0x90, 64, 100, ...variable(240), 0x90, 64, 0, ...variable(240), 0xff, 0x2f, 0];
  return Uint8Array.from([...Buffer.from('MThd'), 0,0,0,6, 0,1, 0,2, 1,0xe0, ...chunk('MTrk',drums),...chunk('MTrk',keys)]);
}
