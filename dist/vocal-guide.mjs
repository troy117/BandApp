import { pitchName } from './instruments.mjs';

export function vocalMelody(song, selected = []) {
  const notes = [], seen = new Set();
  for (const part of song.parts.filter(part => selected.includes(part.id))) for (const note of part.notes) {
    const id = note.tick + ':' + note.pitch;
    if (seen.has(id)) continue;
    seen.add(id);
    const position = song.timeline.position(note.tick);
    notes.push({ id: 'vocal:' + id, pitch: note.pitch, time: song.timeline.tickToSeconds(note.tick), duration: song.timeline.tickToSeconds(note.endTick ?? note.tick + song.ppq / 4) - song.timeline.tickToSeconds(note.tick), quarter: note.tick / song.ppq, velocity: note.velocity / 127, bar: position.bar, beat: position.beat, status: 'pending' });
  }
  if (notes.length > 50000) throw new Error('Choose vocal tracks with at most 50,000 notes.');
  return notes.sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

export function vocalTarget(notes, time) {
  const active = notes.filter(note => note.time <= time && time < note.time + note.duration);
  const next = notes.find(note => note.time > time);
  const pitches = [...new Set(active.map(note => note.pitch))];
  return { active, next, label: pitches.length ? pitches.map(pitchName).join(' + ') : next ? 'Rest · next ' + pitchName(next.pitch) : 'Rest' };
}

// This is a pitch/duration guide from the supplied MIDI, not recovered publisher engraving.
const naturalPitch = [0, 2, 4, 5, 7, 9, 11];
export function vocalStaffPosition(pitch) {
  const semitone = pitch % 12, natural = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][semitone];
  return { step: Math.floor(pitch / 12 - 1) * 7 + natural - 30, sharp: naturalPitch[natural] !== semitone };
}
export function drawVocalStaff(context, width, height, chart, time) {
  context.clearRect(0, 0, width, height);
  const left = 45, right = width - 12, playX = Math.min(width * 0.3, 150), speed = Math.max(35, (right - playX) / 4.5), gap = 12;
  const bottom = height * 0.48 + 2 * gap, yAt = pitch => bottom - vocalStaffPosition(pitch).step * gap / 2;
  context.lineWidth = 1; context.strokeStyle = '#6b858777';
  for (let line = 0; line < 5; line++) { const y = bottom - line * gap; context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke(); }
  context.fillStyle = '#c4d6d0'; context.font = '52px "Segoe UI Symbol", serif'; context.textAlign = 'left'; context.fillText('𝄞', 10, bottom + 3);
  for (const beat of chart.beats || []) {
    if (!beat.downbeat) continue;
    const x = playX + (beat.time - time) * speed;
    if (x < left || x > right) continue;
    context.strokeStyle = '#69878944'; context.beginPath(); context.moveTo(x, bottom - 4 * gap); context.lineTo(x, bottom); context.stroke();
    context.font = '10px system-ui'; context.fillStyle = '#8da5a5'; context.fillText(String(beat.sourceBar ?? beat.bar), x + 3, bottom - 4 * gap - 12);
  }
  for (const note of chart.notes) {
    const x = playX + (note.time - time) * speed, end = playX + (note.time + note.duration - time) * speed;
    if (end < left || x > right) continue;
    const active = note.time <= time && time < note.time + note.duration, y = yAt(note.pitch), { step, sharp } = vocalStaffPosition(note.pitch), color = active ? '#63d9c4' : '#e8c17b';
    context.fillStyle = color + '44'; context.fillRect(Math.max(left, x), y - 3, Math.max(0, Math.min(right, end) - Math.max(left, x)), 6);
    if (x < left) continue;
    context.strokeStyle = color; context.lineWidth = 1;
    for (let ledger = -2; ledger >= step; ledger -= 2) { const ly = bottom - ledger * gap / 2; context.beginPath(); context.moveTo(x - 11, ly); context.lineTo(x + 11, ly); context.stroke(); }
    for (let ledger = 10; ledger <= step; ledger += 2) { const ly = bottom - ledger * gap / 2; context.beginPath(); context.moveTo(x - 11, ly); context.lineTo(x + 11, ly); context.stroke(); }
    context.fillStyle = color; context.beginPath(); context.ellipse(x, y, 6.5, 4.5, -0.3, 0, Math.PI * 2); context.fill();
    const up = step < 4; context.beginPath(); context.moveTo(x + (up ? 6 : -6), y); context.lineTo(x + (up ? 6 : -6), y + (up ? -28 : 28)); context.stroke();
    context.font = '12px system-ui'; context.textAlign = 'center'; context.fillText(pitchName(note.pitch), x, height - 15); context.textAlign = 'left';
    if (sharp) context.fillText('♯', x - 20, y + 4);
  }
  context.strokeStyle = '#63d9c4'; context.lineWidth = 2; context.beginPath(); context.moveTo(playX, 14); context.lineTo(playX, height - 32); context.stroke();
}
