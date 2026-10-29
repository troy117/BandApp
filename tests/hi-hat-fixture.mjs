// Original synthetic MIDI, with closed/open bow, pedal, closed/open edge, and releases.
export function hiHatMidi() {
  const text=value=>[...Buffer.from(value)],u32=value=>[value>>>24,value>>>16&255,value>>>8&255,value&255];
  const bytes=[0,0xff,3,6,...text('Hi-hat'),0,0xff,0x51,3,7,0xa1,0x20];
  for(const pitch of [42,46,44,22,26])bytes.push(0,0x99,pitch,100,120,0x99,pitch,0,120,0xb9,4,64);
  bytes.push(0,0xff,0x2f,0);
  return Uint8Array.from([...text('MThd'),0,0,0,6,0,0,0,1,1,0xe0,...text('MTrk'),...u32(bytes.length),...bytes]);
}
