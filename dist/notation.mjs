import { DRUMS } from './engine.mjs';

// One rhythmic voice, notated exactly on the authored sixteenth-note grid.
export const STAFF_POSITIONS = { kick: 3.5, snare: 1.5, hihat: -0.5, tom1: 0.5, tom2: 1, tom3: 2.5, crash: -1, ride: 0 };
export function createNotation(chart) {
  if (chart.kind !== 'groove') return null;
  const onsets = new Map();
  for (const note of chart.notes) {
    const step = Math.round(((note.bar - 1) * 4 + note.beat - 1) * 4);
    if (!onsets.has(step)) onsets.set(step, []);
    onsets.get(step).push(note);
  }
  const timeline = [...chart.beats.map(beat => ({ time: beat.time, beat: (beat.bar - 1) * 4 + beat.beat - 1 })), { time: chart.duration, beat: chart.bars * 4 }];
  const groups = [];
  for (let beat = 0; beat < chart.bars * 4; beat++) {
    const present = [0, 1, 2, 3].filter(offset => onsets.has(beat * 4 + offset));
    const unit = !present.length || present.every(offset => offset === 0) ? 4 : present.every(offset => offset % 2 === 0) ? 2 : 1;
    for (let offset = 0; offset < 4; offset += unit) {
      const notes = onsets.get(beat * 4 + offset) || [];
      const time = timeline[beat].time + (timeline[beat + 1].time - timeline[beat].time) * offset / 4;
      groups.push({ beat: beat + offset / 4, bar: Math.floor(beat / 4) + 1, notes, time, durationBeats: unit / 4, rest: !notes.length });
    }
  }
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i], next = groups[i + 1];
    group.beamNext = !group.rest && next && !next.rest && group.durationBeats < 1 && Math.floor(next.beat) === Math.floor(group.beat);
    group.beamBack = Boolean(groups[i - 1]?.beamNext);
  }
  return { groups, bars: chart.bars, totalBeats: chart.bars * 4, secondsPerBeat: 60 / chart.bpm, timeline, subdivisions: groups.some(group => group.durationBeats === 0.25) ? 4 : 2 };
}

export function scoreBeatAtTime(notation, time) {
  const timeline = notation.timeline;
  let lo = 0, hi = timeline.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (timeline[mid].time <= time) lo = mid + 1; else hi = mid; }
  const current = timeline[Math.max(0, lo - 1)], next = timeline[lo];
  return !next ? notation.totalBeats : Math.max(0, current.beat + (time - current.time) / (next.time - current.time) * (next.beat - current.beat));
}

export function sheetGeometry(width, height, totalBeats, beat, subdivisions = 2) {
  const gutter = width < 480 ? 72 : 82;
  const spacing = subdivisions === 4 ? (width < 480 ? 104 : 120) : width < 480 ? 66 : 84;
  const right = width - 22;
  const followAt = gutter + (right - gutter) * 0.38;
  const progress = Math.max(0, Math.min(totalBeats, beat)) * spacing;
  const maxScroll = Math.max(0, totalBeats * spacing - (right - gutter));
  const scroll = Math.min(maxScroll, Math.max(0, gutter + progress - followAt));
  const staffTop = Math.max(105, height * 0.36);
  return { gutter, spacing, right, scroll, staffTop, lineGap: 13, playhead: gutter + progress - scroll, x: value => gutter + value * spacing - scroll };
}

export function nextHitGroup(chart, time) {
  // Keep an onset visible briefly after its beat, including simultaneous voices.
  let lo = 0, hi = chart.notes.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (chart.notes[mid].time < time - 0.11) lo = mid + 1; else hi = mid; }
  const first = lo;
  if (first >= chart.notes.length) return null;
  const at = chart.notes[first].time;
  const notes = [];
  for (let i = first; i < chart.notes.length && Math.abs(chart.notes[i].time - at) < 1e-8; i++) notes.push(chart.notes[i]);
  return { time: at, notes, due: time >= at - 0.075 && time <= at + 0.11 };
}

export function drawSheet(ctx, viewport, notation, chart, time, running, demo) {
  const { width: w, height: h } = viewport;
  ctx.clearRect(0, 0, w, h);
  const beat = running ? scoreBeatAtTime(notation, Math.max(0, time)) : 0;
  const g = sheetGeometry(w, h, notation.totalBeats, beat, notation.subdivisions);
  const top = g.staffTop, gap = g.lineGap, bottom = top + gap * 4;
  const headY = drum => top + STAFF_POSITIONS[drum] * gap;
  const beamY = top - 42;

  ctx.fillStyle = '#18272a'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(g.gutter - 15, 47, g.right - g.gutter + 30, h - 75); ctx.clip();
  // Alternating bar backgrounds make the measures readable while they scroll.
  for (let bar = 0; bar < notation.bars; bar++) {
    const x = g.x(bar * 4) - 15, end = g.x((bar + 1) * 4) - 15;
    if (end < g.gutter - 15 || x > g.right) continue;
    ctx.fillStyle = bar % 2 ? '#ffffff03' : '#ffffff08';
    ctx.fillRect(x, 48, end - x, h - 80);
    ctx.fillStyle = '#91aaa6'; ctx.font = '10px Segoe UI, sans-serif'; ctx.textAlign = 'left';
    const pass = chart.passes?.find(item => bar + 1 >= item.firstBar && bar + 1 < item.firstBar + item.bars);
    const sourceBar = pass ? chart.practice.startBar + bar + 1 - pass.firstBar : bar + 1;
    ctx.fillText(`${chart.practice?.repeats > 1 ? `P${pass.index} · ` : ''}BAR ${sourceBar}`, x + 8, 65);
    ctx.strokeStyle = '#718884'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let line = 0; line < 5; line++) {
    ctx.strokeStyle = '#81959188'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.gutter - 15, top + line * gap); ctx.lineTo(g.right + 15, top + line * gap); ctx.stroke();
  }
  for (let count = 0; count < notation.totalBeats * notation.subdivisions; count++) {
    const sub = count % notation.subdivisions;
    const x = g.x(count / notation.subdivisions);
    if (x < g.gutter - 8 || x > g.right + 8) continue;
    ctx.fillStyle = sub ? '#829c94' : '#c0d0c5';
    ctx.font = sub ? '11px Segoe UI, sans-serif' : '600 12px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(sub ? (notation.subdivisions === 4 ? ['', 'e', '&', 'a'][sub] : '&') : String(Math.floor(count / notation.subdivisions) % 4 + 1), x, bottom + 48);
  }
  const finalX = g.x(notation.totalBeats) - 15;
  ctx.strokeStyle = '#91a69b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(finalX - 4, top); ctx.lineTo(finalX - 4, bottom); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(finalX, top); ctx.lineTo(finalX, bottom); ctx.stroke();

  for (let i = 0; i < notation.groups.length; i++) {
    const group = notation.groups[i], x = g.x(group.beat);
    if (x < g.gutter - 60 || x > g.right + 60) continue;
    if (group.rest) { drawRest(ctx, x, top + gap * 2, group.durationBeats); continue; }
    const due = running && Math.abs(group.time - time) < 0.085;
    const lastY = Math.max(...group.notes.map(note => headY(note.drum)));
    ctx.strokeStyle = '#d1dcd2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 6, lastY); ctx.lineTo(x + 6, beamY); ctx.stroke();
    if (group.beamNext) {
      ctx.fillStyle = '#d1dcd2'; ctx.fillRect(x + 6, beamY, g.spacing * group.durationBeats + 1.6, 4);
      if (group.durationBeats === 0.25) ctx.fillRect(x + 6, beamY + 7, g.spacing * group.durationBeats + 1.6, 3);
    } else if (!group.beamBack && group.durationBeats < 1) {
      ctx.strokeStyle = '#d1dcd2'; ctx.lineWidth = 2;
      for (let flag = 0; flag < (group.durationBeats === 0.25 ? 2 : 1); flag++) { ctx.beginPath(); ctx.moveTo(x + 6, beamY + flag * 7); ctx.bezierCurveTo(x + 21, beamY + 7 + flag * 7, x + 19, beamY + 19 + flag * 7, x + 12, beamY + 24 + flag * 7); ctx.stroke(); }
    }
    for (const note of group.notes) {
      const y = headY(note.drum);
      const drum = DRUMS.find(item => item.id === note.drum);
      if (due || (!demo && note.status === 'hit')) {
        ctx.fillStyle = due ? '#e8c17b33' : '#63d9c422';
        ctx.beginPath(); ctx.arc(x, y, due ? 14 : 10, 0, Math.PI * 2); ctx.fill();
      }
      const color = !demo && note.status === 'miss' ? '#f58c99' : drum.color;
      ctx.globalAlpha = !demo && note.status === 'miss' ? 0.5 : 1;
      ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = due ? 3 : 2.2;
      if (note.drum === 'crash') { ctx.strokeStyle = '#9aada1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.stroke(); ctx.strokeStyle = color; ctx.lineWidth = due ? 3 : 2.2; }
      if (['hihat', 'crash', 'ride'].includes(note.drum)) {
        ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y + 4); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x + 5, y - 4); ctx.stroke();
      } else { ctx.beginPath(); ctx.ellipse(x, y, 6.5, 4.5, -0.28, 0, Math.PI * 2); ctx.fill(); }
      if (!demo && note.status === 'hit') {
        ctx.strokeStyle = '#a0f3ce'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 13); ctx.lineTo(x - 1, y - 10); ctx.lineTo(x + 5, y - 17); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  // The audible clock positions the cursor; rendering never supplies grading time.
  ctx.fillStyle = '#e8c17b15'; ctx.fillRect(g.playhead - 11, 73, 22, bottom - 73 + 25);
  ctx.strokeStyle = '#e8c17b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(g.playhead, 77); ctx.lineTo(g.playhead, bottom + 25); ctx.stroke();
  ctx.fillStyle = '#e8c17b'; ctx.beginPath(); ctx.moveTo(g.playhead - 5, 73); ctx.lineTo(g.playhead + 5, 73); ctx.lineTo(g.playhead, 80); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Fixed percussion clef and meter stay visible as the score moves.
  ctx.fillStyle = '#18272a'; ctx.fillRect(0, 47, g.gutter - 16, h - 75);
  ctx.strokeStyle = '#81959188'; ctx.lineWidth = 1;
  for (let line = 0; line < 5; line++) { ctx.beginPath(); ctx.moveTo(10, top + line * gap); ctx.lineTo(g.gutter - 15, top + line * gap); ctx.stroke(); }
  ctx.strokeStyle = '#b7c8bc'; ctx.lineWidth = 3;
  for (const x of [18, 25]) { ctx.beginPath(); ctx.moveTo(x, top + gap); ctx.lineTo(x, top + gap * 3); ctx.stroke(); }
  ctx.fillStyle = '#d4ded0'; ctx.textAlign = 'center'; ctx.font = '600 22px Georgia, serif';
  ctx.fillText('4', g.gutter - 26, top + gap * 1.7); ctx.fillText('4', g.gutter - 26, top + gap * 3.5);
  ctx.fillStyle = '#9fb9ab'; ctx.font = '10px Segoe UI, sans-serif';
  ctx.fillText('COUNT', g.gutter - 34, bottom + 48);
  ctx.textAlign = 'left';
}

function drawRest(ctx, x, y, duration) {
  ctx.strokeStyle = '#9bada2'; ctx.fillStyle = '#9bada2'; ctx.lineWidth = 2;
  if (duration === 1) {
    ctx.beginPath(); ctx.moveTo(x - 2, y - 14); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x - 4, y + 1); ctx.lineTo(x + 4, y + 7); ctx.bezierCurveTo(x - 7, y + 4, x - 7, y + 12, x, y + 15); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x + 5, y - 9); ctx.lineTo(x - 2, y + 13); ctx.stroke();
    for (let flag = 0; flag < (duration === 0.25 ? 2 : 1); flag++) { const fy = y - 6 + flag * 7; ctx.beginPath(); ctx.arc(x - 3 - flag * 2, fy, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 3 - flag * 2, fy + 2); ctx.quadraticCurveTo(x + 3, fy + 4, x + 5 - flag * 2, fy - 3); ctx.stroke(); }
  }
}
