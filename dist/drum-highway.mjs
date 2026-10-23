import { drumHighwayLanes, drumHighwayLane } from './drum-lanes.mjs';
import { keyLabel } from './engine.mjs';
import { nextHitGroup } from './notation.mjs';

export function drawDrumHighway(ctx, viewport, chart, time, { running = false, order, flashes = new Map(), labels = true, bindings = {} } = {}) {
  const laneDrums = drumHighwayLanes(chart, order);
  if (!laneDrums.length) { ctx.clearRect(0, 0, viewport.width, viewport.height); return; }
  const { width: w, height: h } = viewport;
  ctx.clearRect(0, 0, w, h);
  const top = 42, target = h - 87, bottom = target + 21;
  const nearWidth = w * 0.8, farWidth = w * 0.32;
  const at = depth => ({ y: top + (target - top) * depth ** 1.55, left: (w - (farWidth + (nearWidth - farWidth) * depth)) / 2, width: farWidth + (nearWidth - farWidth) * depth });
  const far = at(0), near = at(1);
  ctx.beginPath(); ctx.moveTo(far.left, top); ctx.lineTo(far.left + far.width, top); ctx.lineTo(near.left + near.width, bottom); ctx.lineTo(near.left, bottom); ctx.closePath();
  const grad = ctx.createLinearGradient(0, top, 0, bottom); grad.addColorStop(0, '#18282b'); grad.addColorStop(1, '#1c2b2f'); ctx.fillStyle = grad; ctx.fill();
  const lanes = laneDrums.length;
  const dueGroup = running ? nextHitGroup(chart, time) : null;
  const dueDrums = new Set(dueGroup?.due ? dueGroup.notes.map(note => drumHighwayLane(note)) : []);
  // One outlined receptor per lane. A note's center reaches its box center
  // at its scheduled beat, on the same audible clock used by the sheet view.
  for (let lane = 0; lane < lanes; lane++) {
    const drum = laneDrums[lane];
    const laneWidth = near.width / lanes;
    const x = near.left + laneWidth * lane + laneWidth * 0.08;
    ctx.fillStyle = '#0b1418';
    ctx.beginPath(); ctx.roundRect(x, target - 18, laneWidth * 0.84, 36, 6); ctx.fill();
  }
  for (let lane = 0; lane <= lanes; lane++) {
    ctx.beginPath(); ctx.moveTo(far.left + far.width * lane / lanes, top); ctx.lineTo(near.left + near.width * lane / lanes, bottom);
    ctx.strokeStyle = lane === 0 || lane === lanes ? '#40555766' : '#344a4d66'; ctx.lineWidth = 1; ctx.stroke();
  }
  const lookahead = 3.3;
  const visibleTime = running ? time : -0.4;
  const drawingBeats = [...Array.from({ length: chart.countInBeats }, (_, i) => ({ time: (i - chart.countInBeats) * chart.countInBeatSeconds, downbeat: i === 0, bar: 0 })), ...chart.beats];
  for (const beat of drawingBeats) {
    const delta = beat.time - visibleTime;
    if (delta < 0 || delta > lookahead) continue;
    const p = at(1 - delta / lookahead);
    ctx.beginPath(); ctx.moveTo(p.left, p.y); ctx.lineTo(p.left + p.width, p.y); ctx.strokeStyle = beat.downbeat ? '#627b7c55' : '#3e5a5d55'; ctx.lineWidth = 1; ctx.stroke();
    if (beat.bar > 0 && beat.downbeat) { ctx.font = '8px Segoe UI, sans-serif'; ctx.fillStyle = '#6f898b'; ctx.fillText(String(beat.sourceBar ?? beat.bar).padStart(2, '0'), p.left - 21, p.y + 3); }
  }
  for (let i = chart.notes.length - 1; i >= 0; i--) {
    const note = chart.notes[i];
    const delta = note.time - visibleTime;
    if (delta < -0.2 || delta > lookahead || note.status === 'hit') continue;
    const lane = laneDrums.findIndex(drum => drum.id === drumHighwayLane(note));
    if (lane < 0) continue;
    const drum = laneDrums[lane];
    const depth = Math.min(1.1, 1 - delta / lookahead);
    const p = at(depth);
    const noteWidth = p.width / lanes * 0.74;
    const x = p.left + p.width / lanes * (lane + 0.5) - noteWidth / 2;
    ctx.globalAlpha = note.status === 'miss' ? 0.25 : Math.min(1, 0.28 + depth);
    ctx.shadowColor = drum.color; ctx.shadowBlur = 10 * depth;
    ctx.fillStyle = drum.color;
    const noteHeight = 4 + depth * 7;
    ctx.beginPath(); ctx.roundRect(x, p.y - noteHeight / 2, noteWidth, noteHeight, 2 + depth * 2);
    if (drum.id === 'hihat-open') { ctx.lineWidth = 2; ctx.strokeStyle = drum.color; ctx.stroke(); } else ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(x + 3, p.y - noteHeight / 2 + 1, noteWidth - 6, 1);
    ctx.globalAlpha = 1;
  }
  for (let lane = 0; lane < lanes; lane++) {
    const drum = laneDrums[lane];
    const age = performance.now() - (flashes.get(drum.id) ?? flashes.get(drum.drumId) ?? -Infinity);
    const laneWidth = near.width / lanes;
    const x = near.left + laneWidth * lane + laneWidth * 0.08;
    const due = dueDrums.has(drum.id);
    if (age < 200) {
      const glow = ctx.createLinearGradient(0, target - 85, 0, target); glow.addColorStop(0, drum.color + '00'); glow.addColorStop(1, drum.color + '33');
      ctx.fillStyle = glow; ctx.fillRect(x, target - 85, laneWidth * 0.84, 104);
    }
    ctx.strokeStyle = age < 160 || due ? drum.color : drum.color + 'aa'; ctx.lineWidth = age < 160 || due ? 3 : 1.5;
    if (due || age < 160) { ctx.fillStyle = drum.color + '22'; ctx.beginPath(); ctx.roundRect(x, target - 18, laneWidth * 0.84, 36, 6); ctx.fill(); }
    ctx.beginPath(); ctx.roundRect(x, target - 18, laneWidth * 0.84, 36, 6); ctx.stroke();
    ctx.strokeStyle = drum.color + '77'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 5, target); ctx.lineTo(x + laneWidth * 0.84 - 5, target); ctx.stroke();
    if (labels) {
      ctx.textAlign = 'center'; ctx.fillStyle = drum.color; ctx.font = '9px Segoe UI, sans-serif';
      ctx.fillText(drum.short, x + laneWidth * 0.42, target + 52, laneWidth * 0.94);
      ctx.fillStyle = '#b8c9c4'; ctx.fillText((bindings[drum.drumId] || []).map(keyLabel).join('/'), x + laneWidth * 0.42, target + 68, laneWidth * 0.94); ctx.textAlign = 'left';
    }
  }
  ctx.fillStyle = '#8fa9a5'; ctx.font = '8px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('HIT BOXES · CENTER = BEAT', w / 2, target + 35); ctx.textAlign = 'left';
  const fade = ctx.createLinearGradient(0, 0, 0, 77); fade.addColorStop(0, '#111b1eff'); fade.addColorStop(1, '#111b1e00'); ctx.fillStyle = fade; ctx.fillRect(0, 0, w, 77);
}
