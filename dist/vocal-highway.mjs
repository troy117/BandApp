import { pitchName } from './instruments.mjs';
import { lyricWordTimings } from './lyrics.mjs';

// Prefer saved score word timestamps; older line-only cues keep their approximate spacing.
export function vocalHighwayWords(cues = []) {
  return cues.flatMap(lyricWordTimings);
}

export function vocalHighwayRange(notes, shift = 0) {
  let low = Infinity, high = -Infinity;
  for (const note of notes) { low = Math.min(low, note.pitch + shift); high = Math.max(high, note.pitch + shift); }
  if (!notes.length) return { low: 55, high: 72 };
  const middle = (low + high) / 2, span = Math.max(12, high - low + 4);
  return { low: Math.floor(middle - span / 2), high: Math.ceil(middle + span / 2) };
}

export function vocalHighwayLayout(chart, time, width, height, { shift = 0, range = vocalHighwayRange(chart.notes, shift), words = vocalHighwayWords(chart.lyrics) } = {}) {
  const left = 34, right = Math.max(left + 80, width - 12), top = 21, bottom = Math.max(top + 65, height - 66);
  const playX = left + (right - left) * .17, speed = Math.max(76, (right - left) / 5.5);
  const xAt = at => playX + (at - time) * speed;
  const yAt = pitch => bottom - (pitch - range.low) / Math.max(1, range.high - range.low) * (bottom - top);
  const notes = chart.notes.filter(note => xAt(note.time + note.duration) >= left && xAt(note.time) <= right).map(note => ({
    pitch: note.pitch + shift, x: xAt(note.time), endX: xAt(note.time + Math.max(.04, note.duration)), y: yAt(note.pitch + shift),
    active: note.time <= time && time < note.time + note.duration, past: time >= note.time + note.duration,
  }));
  const lyrics = words.filter(word => xAt(word.end) >= left && xAt(word.time) <= right).map(word => ({ ...word,
    x: xAt(word.time), endX: xAt(word.end), progress: Math.max(0, Math.min(1, (time - word.time) / (word.end - word.time))),
  }));
  const beats = (chart.beats || []).filter(beat => beat.downbeat && xAt(beat.time) >= left && xAt(beat.time) <= right).map(beat => ({ x: xAt(beat.time), bar: beat.sourceBar ?? beat.bar }));
  return { left, right, top, bottom, playX, speed, range, notes, lyrics, beats, yAt, xAt };
}

export function drawVocalHighway(ctx, width, height, frame, history = []) {
  const { left, right, top, bottom, playX, range, yAt, xAt } = frame;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#16203c'; ctx.fillRect(left, top, right - left, bottom - top);
  ctx.font = '10px system-ui'; ctx.textAlign = 'right'; ctx.lineWidth = 1;
  for (let pitch = range.low; pitch <= range.high; pitch++) {
    const y = yAt(pitch), natural = [0, 2, 4, 5, 7, 9, 11].includes((pitch % 12 + 12) % 12);
    ctx.strokeStyle = natural ? '#6889ad33' : '#6889ad14'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    if (pitch % 12 === 0 || pitch === Math.ceil(range.low) || pitch === Math.floor(range.high)) {
      ctx.fillStyle = '#b0c5df'; ctx.fillText(pitchName(pitch), left - 5, y + 3);
    }
  }
  for (const beat of frame.beats) {
    ctx.strokeStyle = '#8195b544'; ctx.beginPath(); ctx.moveTo(beat.x, top); ctx.lineTo(beat.x, bottom); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#8ca1bd'; ctx.fillText(String(beat.bar), beat.x + 4, 13);
  }
  ctx.save(); ctx.beginPath(); ctx.rect(left, top - 7, right - left, bottom - top + 15); ctx.clip();
  ctx.lineCap = 'round';
  for (const note of frame.notes) {
    const start = Math.max(left - 8, note.x), end = Math.min(right + 8, Math.max(note.x + 2, note.endX));
    ctx.strokeStyle = note.past ? '#496078' : note.active ? '#ffe19a' : '#c2a663'; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(start, note.y); ctx.lineTo(end, note.y); ctx.stroke();
    ctx.strokeStyle = note.past ? '#30475f' : note.active ? '#8af0e1' : '#46cfe8'; ctx.lineWidth = 7;
    ctx.shadowColor = '#4edcf1'; ctx.shadowBlur = note.active ? 11 : 3;
    ctx.beginPath(); ctx.moveTo(start, note.y); ctx.lineTo(end, note.y); ctx.stroke(); ctx.shadowBlur = 0;
  }
  let previous;
  for (const point of history) {
    const x = xAt(point.time), y = Math.max(top, Math.min(bottom, yAt(point.pitch)));
    if (x < left - 5 || x > playX + 4) { previous = null; continue; }
    ctx.strokeStyle = point.onPitch ? '#b1ffbc' : '#f6b9d5'; ctx.lineWidth = 3;
    if (previous && point.time - previous.time < .25 && Math.abs(point.pitch - previous.pitch) < 5) {
      ctx.beginPath(); ctx.moveTo(xAt(previous.time), Math.max(top, Math.min(bottom, yAt(previous.pitch)))); ctx.lineTo(x, y); ctx.stroke();
    }
    previous = point;
  }
  const latest = history.at(-1);
  if (latest && Math.abs(xAt(latest.time) - playX) < frame.speed * .5) {
    ctx.fillStyle = latest.onPitch ? '#b1ffbc' : '#f6b9d5'; ctx.beginPath(); ctx.arc(xAt(latest.time), Math.max(top, Math.min(bottom, yAt(latest.pitch))), 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const lyricY = bottom + 33;
  ctx.fillStyle = '#111e31'; ctx.fillRect(left, bottom + 14, right - left, 40);
  ctx.save(); ctx.beginPath(); ctx.rect(left, bottom + 14, right - left, 40); ctx.clip();
  ctx.textAlign = 'left'; ctx.font = '600 ' + (width < 500 ? 13 : 16) + 'px system-ui';
  for (const word of frame.lyrics) {
    const available = Math.max(3, word.endX - word.x - 4), textWidth = Math.min(available, ctx.measureText(word.text).width);
    ctx.fillStyle = '#fff'; ctx.fillText(word.text, word.x, lyricY, available);
    if (word.progress) {
      ctx.save(); ctx.beginPath(); ctx.rect(word.x, lyricY - 19, textWidth * word.progress, 27); ctx.clip();
      ctx.fillStyle = '#ffe09a'; ctx.fillText(word.text, word.x, lyricY, available); ctx.restore();
    }
  }
  ctx.restore();
  ctx.strokeStyle = '#edf7ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(playX, top - 6); ctx.lineTo(playX, bottom + 54); ctx.stroke();
  ctx.fillStyle = '#d9e9f4'; ctx.textAlign = 'center'; ctx.font = '9px system-ui'; ctx.fillText('SING HERE', playX, height - 3);
}

export class VocalHighway {
  constructor(canvas) { this.canvas = canvas; this.history = []; }
  reset() { this.history = []; this.chart = null; this.lastTime = null; }
  draw(chart, time, { shift = 0, feedback, playing = false, sampleTime = time } = {}) {
    if (!this.canvas.getBoundingClientRect().width) return;
    if (this.chart !== chart || this.shift !== shift) {
      this.chart = chart; this.shift = shift; this.words = vocalHighwayWords(chart.lyrics); this.range = vocalHighwayRange(chart.notes, shift); this.history = []; this.lastTime = null;
    }
    if (this.lastTime !== null && (time < this.lastTime - .05 || time - this.lastTime > .75)) this.history = [];
    this.lastTime = time;
    if (playing && Number.isFinite(feedback?.cents) && (!this.history.length || sampleTime - this.history.at(-1).time >= .045)) {
      const note = chart.notes.find(note => note.time <= sampleTime && sampleTime < note.time + note.duration);
      if (note) this.history.push({ time: sampleTime, pitch: note.pitch + shift + feedback.cents / 100, onPitch: feedback.state === 'on-pitch' });
    }
    this.history = this.history.filter(point => time - point.time < 3);
    const rect = this.canvas.getBoundingClientRect(), width = Math.max(160, rect.width), height = rect.height, dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) { this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr); }
    const ctx = this.canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const frame = vocalHighwayLayout(chart, time, width, height, { shift, words: this.words, range: this.range });
    drawVocalHighway(ctx, width, height, frame, this.history);
  }
}
