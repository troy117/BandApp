import { DRUMS } from './engine.mjs';

// A single percussion rhythm voice. Display rounding never changes judged MIDI times.
export const STAFF_POSITIONS = { kick: 3.5, snare: 1.5, hihat: -0.5, 'hihat-open': -0.5, 'hihat-pedal': 4.5, tom1: 0.5, tom2: 1, tom3: 2.5, crash: -1, ride: 0 };
export function createNotation(chart) {
  if (!chart.notes?.length || !chart.beats?.length) return null;
  const measures = (chart.measures || Array.from({ length: chart.bars }, (_, i) => ({ bar: i + 1, startQuarter: i * 4, endQuarter: (i + 1) * 4, time: chart.beats[i * 4].time, endTime: chart.beats[(i + 1) * 4]?.time ?? chart.duration, numerator: 4, denominator: 4 }))).map(measure => ({ ...measure, tuplets: false }));
  const totalBeats = measures.at(-1).endQuarter;
  const point = item => ({ time: item.time, beat: item.quarter ?? (item.bar - 1) * 4 + item.beat - 1 });
  const points = [...chart.beats.map(point), ...chart.notes.map(point), ...chart.tempos?.filter(item => Number.isFinite(item.quarter)).map(point) || [], ...measures.flatMap(m => [{ time: m.time, beat: m.startQuarter }, { time: m.endTime, beat: m.endQuarter }]), { time: chart.duration, beat: totalBeats }];
  const timeline = [...new Map(points.sort((a, b) => a.time - b.time).map(item => [item.time, item])).values()];
  const groups = [];
  let approximate = false;
  const notesByBar = new Map();
  for (const note of chart.notes) { if (!notesByBar.has(note.bar)) notesByBar.set(note.bar, []); notesByBar.get(note.bar).push(note); }
  for (const measure of measures) {
    const hits = notesByBar.get(measure.bar) || [];
    const length = measure.endQuarter - measure.startQuarter;
    const relative = note => (note.quarter ?? measure.startQuarter + (note.beat - 1) * 4 / measure.denominator) - measure.startQuarter;
    // Try ordinary rhythms and triplets through 32nd notes; expressive offsets are
    // rounded only for engraving, while the cursor follows the unrounded clock.
    const divisions = [1, 2, 3, 4, 6, 8, 12, 24].find(div => hits.every(note => Math.abs(relative(note) * div - Math.round(relative(note) * div)) / div < 0.012)) || 12;
    const onsets = new Map();
    for (const note of hits) {
      const slot = Math.max(0, Math.min(Math.ceil(length * divisions - 1e-8) - 1, Math.round(relative(note) * divisions)));
      if (Math.abs(slot / divisions - relative(note)) > 1e-6) approximate = true;
      if (!onsets.has(slot)) onsets.set(slot, []);
      onsets.get(slot).push(note);
    }
    for (let local = 0; local < length - 1e-8; local += 1) {
      const part = Math.min(1, length - local);
      const offsets = [...onsets.keys()].filter(slot => slot >= local * divisions - 1e-7 && slot < (local + part) * divisions - 1e-7).map(slot => slot - local * divisions);
      const unit = !offsets.length || offsets.every(offset => Math.abs(offset) < 1e-7) ? part : [1, 2, 3, 4, 6, 8, 12, 24].filter(div => div <= divisions).map(div => 1 / div).find(value => offsets.every(offset => Math.abs(offset / divisions / value - Math.round(offset / divisions / value)) < 1e-7)) || 1 / divisions;
      for (let offset = 0; offset < part - 1e-8; offset += unit) {
        const notes = onsets.get(Math.round((local + offset) * divisions)) || [];
        const beat = measure.startQuarter + local + offset, durationBeats = Math.min(unit, part - offset);
        const tuplet = Math.abs(durationBeats - 1 / 3) < 1e-7 || Math.abs(durationBeats - 1 / 6) < 1e-7 || Math.abs(durationBeats - 1 / 12) < 1e-7;
        groups.push({ beat, bar: measure.bar, notes, time: notes[0]?.time ?? timeAtScoreBeat(timeline, beat), durationBeats, rest: !notes.length, tuplet, tupletStart: tuplet && offset === 0, tupletCount: Math.round(1 / durationBeats) });
      }
    }
  }
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i], next = groups[i + 1];
    const measure = measures[group.bar - 1];
    if (group.tuplet) measure.tuplets = true;
    const beamUnit = measure.denominator === 8 && measure.numerator % 3 === 0 ? 1.5 : 1;
    group.beamNext = !group.rest && next && next.bar === group.bar && !next.rest && group.durationBeats < 1 && Math.floor((next.beat - measure.startQuarter + 1e-7) / beamUnit) === Math.floor((group.beat - measure.startQuarter + 1e-7) / beamUnit);
    group.beamBack = Boolean(groups[i - 1]?.beamNext);
  }
  return { groups, measures, bars: chart.bars, totalBeats, secondsPerBeat: 60 / chart.bpm, timeline, approximate, subdivisions: groups.some(group => group.durationBeats < 0.5) ? 4 : 2 };
}

function timeAtScoreBeat(timeline, beat) {
  let lo = 0, hi = timeline.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (timeline[mid].beat <= beat) lo = mid + 1; else hi = mid; }
  const a = timeline[Math.max(0, lo - 1)], b = timeline[lo];
  return b ? a.time + (beat - a.beat) / (b.beat - a.beat) * (b.time - a.time) : a.time;
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

export function drawSheet(ctx, viewport, notation, chart, time, running, demo, options = {}) {
  const { width: w, height: h } = viewport;
  ctx.clearRect(0, 0, w, h);
  const beat = running ? scoreBeatAtTime(notation, Math.max(0, time)) : 0;
  const g = options.geometry || sheetGeometry(w, h, notation.totalBeats, beat, notation.subdivisions);
  const compact = options.compact;
  const clipTop = compact ? 0 : 47, labelY = compact ? 20 : 65, cursorTop = compact ? 36 : 73;
  const top = g.staffTop, gap = g.lineGap, bottom = top + gap * 4;
  const countY = bottom + (options.countOffset ?? 48);
  const headY = drum => top + STAFF_POSITIONS[drum] * gap;
  const beamY = top - 42;

  ctx.fillStyle = '#18272a'; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(g.gutter - 15, clipTop, g.right - g.gutter + 30, h - clipTop - 28); ctx.clip();
  // Alternating bar backgrounds make the measures readable while they scroll.
  for (let bar = 0; bar < notation.bars; bar++) {
    const measure = notation.measures[bar];
    const x = g.x(measure.startQuarter) - 15, end = g.x(measure.endQuarter) - 15;
    if (end < g.gutter - 15 || x > g.right) continue;
    ctx.fillStyle = bar % 2 ? '#ffffff03' : '#ffffff08';
    ctx.fillRect(x, clipTop + 1, end - x, h - clipTop - 33);
    ctx.fillStyle = '#91aaa6'; ctx.font = '10px Segoe UI, sans-serif'; ctx.textAlign = 'left';
    const pass = chart.passes?.find(item => measure.bar >= item.firstBar && measure.bar < item.firstBar + item.bars);
    const sourceBar = measure.sourceBar ?? (pass ? chart.practice.startBar + measure.bar - pass.firstBar : measure.bar);
    ctx.fillText(`${chart.practice?.repeats > 1 ? `P${pass.index} · ` : ''}BAR ${sourceBar}`, x + 8, labelY);
    if (bar && (measure.numerator !== notation.measures[bar - 1].numerator || measure.denominator !== notation.measures[bar - 1].denominator)) { ctx.fillStyle = '#e8c17b'; ctx.fillText(`${measure.numerator}/${measure.denominator}`, x + 8, labelY + 17); }
    ctx.strokeStyle = '#718884'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }
  for (let line = 0; line < 5; line++) {
    ctx.strokeStyle = '#81959188'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(g.gutter - 15, top + line * gap); ctx.lineTo(g.right + 15, top + line * gap); ctx.stroke();
  }
  for (const measure of notation.measures) for (let count = 0; count < measure.numerator * (measure.denominator === 4 ? notation.subdivisions : 1); count++) {
    const divisions = measure.denominator === 4 ? notation.subdivisions : 1;
    const at = measure.startQuarter + count / divisions * 4 / measure.denominator;
    if (at >= measure.endQuarter - 1e-8) continue;
    const sub = count % divisions;
    const x = g.x(at);
    if (x < g.gutter - 8 || x > g.right + 8) continue;
    ctx.fillStyle = sub ? '#829c94' : '#c0d0c5';
    ctx.font = sub ? '11px Segoe UI, sans-serif' : '600 12px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    const triplets = measure.tuplets;
    if (!sub || !triplets) ctx.fillText(sub ? (divisions === 4 ? ['', 'e', '&', 'a'][sub] : '&') : String(Math.floor(count / divisions) + 1), x, countY);
  }
  const finalX = g.x(notation.totalBeats) - 15;
  ctx.strokeStyle = '#91a69b'; ctx.lineWidth = 1;
  if (options.final !== false) { ctx.beginPath(); ctx.moveTo(finalX - 4, top); ctx.lineTo(finalX - 4, bottom); ctx.stroke(); }
  ctx.lineWidth = options.final === false ? 1 : 3; ctx.beginPath(); ctx.moveTo(finalX, top); ctx.lineTo(finalX, bottom); ctx.stroke();

  for (let i = 0; i < notation.groups.length; i++) {
    const group = notation.groups[i], x = g.x(group.beat);
    if (x < g.gutter - 60 || x > g.right + 60) continue;
    if (group.tupletStart) { ctx.fillStyle = '#c5d4cb'; ctx.font = 'italic 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(String(group.tupletCount), x + (g.x(group.beat + 1) - x) / 3, beamY - 9); }
    if (group.rest) { drawRest(ctx, x, top + gap * 2, group.durationBeats, group.tuplet); continue; }
    const due = running && Math.abs(group.time - time) < 0.085;
    const lastY = Math.max(...group.notes.map(note => headY(note.drum)));
    ctx.strokeStyle = '#d1dcd2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x + 6, lastY); ctx.lineTo(x + 6, beamY); ctx.stroke();
    if (group.beamNext || group.beamBack) {
      ctx.fillStyle = '#d1dcd2';
      const next = notation.groups[i + 1], previous = notation.groups[i - 1];
      for (let beam = 0; beam < rhythmFlags(group.durationBeats, group.tuplet); beam++) {
        if (group.beamNext && rhythmFlags(next.durationBeats, next.tuplet) > beam) ctx.fillRect(x + 6, beamY + beam * 7, g.x(next.beat) - x + 1.6, beam ? 3 : 4);
        else if (!(group.beamBack && rhythmFlags(previous.durationBeats, previous.tuplet) > beam)) { const stub = Math.min(11, (g.x(group.beat + group.durationBeats) - x) * 0.6); ctx.fillRect(x + 6 - (group.beamNext ? 0 : stub), beamY + beam * 7, stub, beam ? 3 : 4); }
      }
    } else if (group.durationBeats < 1) {
      ctx.strokeStyle = '#d1dcd2'; ctx.lineWidth = 2;
      for (let flag = 0; flag < rhythmFlags(group.durationBeats, group.tuplet); flag++) { ctx.beginPath(); ctx.moveTo(x + 6, beamY + flag * 7); ctx.bezierCurveTo(x + 21, beamY + 7 + flag * 7, x + 19, beamY + 19 + flag * 7, x + 12, beamY + 24 + flag * 7); ctx.stroke(); }
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
      if (['hihat', 'hihat-open', 'hihat-pedal', 'crash', 'ride'].includes(note.drum)) {
        ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y + 4); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x + 5, y - 4); ctx.stroke();
      } else { ctx.beginPath(); ctx.ellipse(x, y, 6.5, 4.5, -0.28, 0, Math.PI * 2); ctx.fill(); }
      if(note.drum==='hihat-open'){ctx.beginPath();ctx.arc(x,y-13,3.5,0,Math.PI*2);ctx.stroke();}
      if (!demo && note.status === 'hit') {
        ctx.strokeStyle = '#a0f3ce'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 13); ctx.lineTo(x - 1, y - 10); ctx.lineTo(x + 5, y - 17); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  // The audible clock positions the cursor; rendering never supplies grading time.
  if (options.cursor !== false) {
  ctx.fillStyle = '#e8c17b15'; ctx.fillRect(g.playhead - 11, cursorTop, 22, bottom - cursorTop + 25);
  ctx.strokeStyle = '#e8c17b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(g.playhead, cursorTop + 4); ctx.lineTo(g.playhead, bottom + 25); ctx.stroke();
  ctx.fillStyle = '#e8c17b'; ctx.beginPath(); ctx.moveTo(g.playhead - 5, cursorTop); ctx.lineTo(g.playhead + 5, cursorTop); ctx.lineTo(g.playhead, cursorTop + 7); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // Fixed percussion clef and meter stay visible as the score moves.
  ctx.fillStyle = '#18272a'; ctx.fillRect(0, clipTop, g.gutter - 16, h - clipTop - 28);
  ctx.strokeStyle = '#81959188'; ctx.lineWidth = 1;
  for (let line = 0; line < 5; line++) { ctx.beginPath(); ctx.moveTo(10, top + line * gap); ctx.lineTo(g.gutter - 15, top + line * gap); ctx.stroke(); }
  ctx.strokeStyle = '#b7c8bc'; ctx.lineWidth = 3;
  for (const x of [18, 25]) { ctx.beginPath(); ctx.moveTo(x, top + gap); ctx.lineTo(x, top + gap * 3); ctx.stroke(); }
  ctx.fillStyle = '#d4ded0'; ctx.textAlign = 'center'; ctx.font = '600 22px Georgia, serif';
  const currentMeter = options.meter || notation.measures.findLast(measure => measure.startQuarter <= beat) || notation.measures[0];
  ctx.fillText(String(currentMeter.numerator), g.gutter - 26, top + gap * 1.7); ctx.fillText(String(currentMeter.denominator), g.gutter - 26, top + gap * 3.5);
  ctx.fillStyle = '#9fb9ab'; ctx.font = '10px Segoe UI, sans-serif';
  ctx.fillText('COUNT', g.gutter - 34, countY);
  ctx.textAlign = 'left';
}

function rhythmFlags(duration, tuplet) { return Math.max(0, Math.round(-Math.log2(duration * (tuplet ? 1.5 : 1)))); }
function drawRest(ctx, x, y, duration, tuplet) {
  ctx.strokeStyle = '#9bada2'; ctx.fillStyle = '#9bada2'; ctx.lineWidth = 2;
  if (duration === 1) {
    ctx.beginPath(); ctx.moveTo(x - 2, y - 14); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x - 4, y + 1); ctx.lineTo(x + 4, y + 7); ctx.bezierCurveTo(x - 7, y + 4, x - 7, y + 12, x, y + 15); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x + 5, y - 9); ctx.lineTo(x - 2, y + 13); ctx.stroke();
    for (let flag = 0; flag < rhythmFlags(duration, tuplet); flag++) { const fy = y - 6 + flag * 7; ctx.beginPath(); ctx.arc(x - 3 - flag * 2, fy, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 3 - flag * 2, fy + 2); ctx.quadraticCurveTo(x + 3, fy + 4, x + 5 - flag * 2, fy - 3); ctx.stroke(); }
  }
}
