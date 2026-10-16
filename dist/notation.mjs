import { DRUMS } from './engine.mjs';

// One rhythmic voice: simultaneous drum heads share a stem. The built-in
// exercises contain quarter/eighth notes in 4/4, with no quantization needed.
export const STAFF_POSITIONS = { kick: 3.5, snare: 1.5, hihat: -0.5 };
export function createNotation(chart) {
  if (chart.kind !== 'groove') return null;
  const groups = [];
  for (const note of chart.notes) {
    let group = groups.at(-1);
    if (!group || Math.abs(group.time - note.time) > 1e-8) {
      group = { time: note.time, beat: (note.bar - 1) * 4 + note.beat - 1, bar: note.bar, notes: [] };
      groups.push(group);
    }
    group.notes.push(note);
  }
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    group.durationBeats = (groups[i + 1]?.beat ?? chart.bars * 4) - group.beat;
    group.beamNext = group.durationBeats === 0.5 && Number.isInteger(group.beat) && groups[i + 1]?.beat === group.beat + 0.5 && groups[i + 1]?.bar === group.bar;
  }
  return { groups, bars: chart.bars, totalBeats: chart.bars * 4, secondsPerBeat: 60 / chart.bpm };
}

export function sheetGeometry(width, height, totalBeats, beat) {
  const gutter = width < 480 ? 72 : 82;
  const spacing = width < 480 ? 66 : 84;
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
  const beat = running ? Math.max(0, time) / notation.secondsPerBeat : 0;
  const g = sheetGeometry(w, h, notation.totalBeats, beat);
  const top = g.staffTop, gap = g.lineGap, bottom = top + gap * 4;
  const headY = drum => top + STAFF_POSITIONS[drum] * gap;
  const beamY = top - 36;

  ctx.fillStyle = '#18272a'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(g.gutter - 15, 47, g.right - g.gutter + 30, h - 75); ctx.clip();
  // Alternating bar backgrounds make the measures readable while they scroll.
  for (let bar = 0; bar < notation.bars; bar++) {
    const x = g.x(bar * 4) - 15, end = g.x((bar + 1) * 4) - 15;
    if (end < g.gutter - 15 || x > g.right) continue;
    ctx.fillStyle = bar % 2 ? '#ffffff03' : '#ffffff08';
    ctx.fillRect(x, 48, end - x, h - 80);
    ctx.fillStyle = '#91aaa6'; ctx.font = '10px Segoe UI, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`BAR ${bar + 1}`, x + 8, 65);
    ctx.strokeStyle = '#718884'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let line = 0; line < 5; line++) {
    ctx.strokeStyle = '#81959188'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.gutter - 15, top + line * gap); ctx.lineTo(g.right + 15, top + line * gap); ctx.stroke();
  }
  for (let count = 0; count < notation.totalBeats * 2; count++) {
    const x = g.x(count / 2);
    if (x < g.gutter - 8 || x > g.right + 8) continue;
    ctx.fillStyle = count % 2 ? '#829c94' : '#c0d0c5';
    ctx.font = count % 2 ? '11px Segoe UI, sans-serif' : '600 12px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(count % 2 ? '&' : String(count / 2 % 4 + 1), x, bottom + 48);
  }
  const finalX = g.x(notation.totalBeats) - 15;
  ctx.strokeStyle = '#91a69b'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(finalX - 4, top); ctx.lineTo(finalX - 4, bottom); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(finalX, top); ctx.lineTo(finalX, bottom); ctx.stroke();

  for (let i = 0; i < notation.groups.length; i++) {
    const group = notation.groups[i], x = g.x(group.beat);
    if (x < g.gutter - 60 || x > g.right + 60) continue;
    const due = running && Math.abs(group.time - time) < 0.085;
    const lastY = Math.max(...group.notes.map(note => headY(note.drum)));
    ctx.strokeStyle = '#d1dcd2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 6, lastY); ctx.lineTo(x + 6, beamY); ctx.stroke();
    if (group.beamNext) {
      ctx.fillStyle = '#d1dcd2'; ctx.fillRect(x + 6, beamY, g.spacing * 0.5 + 1.6, 4);
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
      if (note.drum === 'hihat') {
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
