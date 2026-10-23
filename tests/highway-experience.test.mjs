import test from 'node:test';
import assert from 'node:assert/strict';
import { highwayPerformance, arcadePulse, drawArcadeBackdrop, drawArcadeBurst } from '../dist/highway-experience.mjs';
import { createChart, Judge } from '../dist/engine.mjs';
import { PitchJudge } from '../dist/instruments.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';
import { FollowCursor } from '../dist/follow-along.mjs';
import { drawDrumHighway } from '../dist/drum-highway.mjs';
import { drawFretted } from '../dist/follow-view.mjs';

test('live meter counts only judged notes and penalizes misses, wrong notes and extras', () => {
  const judge = new Judge(createChart('rock', 80, 4));
  assert.equal(highwayPerformance(judge, -1, { playing: true }).label, 'Count-in');
  assert.equal(highwayPerformance(judge, 0, { playing: true }).value, null);
  judge.strike('kick', 0); assert.equal(highwayPerformance(judge, 0, { playing: true }).value, 100);
  judge.strike('tom3', .01); const frame = highwayPerformance(judge, .02, { playing: true });
  assert.equal(frame.value, 50); assert.equal(frame.streak, 0);
  judge.advance(1); assert.ok(highwayPerformance(judge, 1, { playing: true }).value < 50);
  const piano = new PitchJudge(builtinArrangement().parts[1].chart); piano.strike(61, 0);
  assert.equal(highwayPerformance(piano, .1, { playing: true }).value, 0);
});
test('listen, teacher and guitar/bass follow modes show progress without invented scores', () => {
  const judge = new Judge(createChart('rock', 80, 4)), options = { playing: true };
  for (const mode of [{ listen: true }, { teacher: true }]) { const frame = highwayPerformance(judge, judge.chart.duration / 2, { ...options, ...mode }); assert.equal(frame.kind, 'progress'); assert.equal(frame.value, 50); assert.equal(frame.streak, null); }
  const follow = new FollowCursor(builtinArrangement('band-first').parts[2].chart);
  assert.equal(highwayPerformance(follow, 999, options).value, 100); assert.equal(highwayPerformance(follow, 0, options).detail, 'Song progress');
  assert.equal(highwayPerformance(judge, 1).kind, 'ready');
});
test('arcade visuals preserve chart data and draw finite geometry at narrow/fullscreen sizes', () => {
  const context = new Proxy({}, { get: (_obj, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...args) => { assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value))); } });
  const drums = createChart('rock', 80, 4); drums.notes[0].status = 'hit'; drums.notes[0].actualTime = 0;
  const original = structuredClone(drums), guitar = builtinArrangement('band-first').parts[2].chart;
  for (const width of [180, 1100]) for (const motion of [false, true]) {
    drawDrumHighway(context, { width, height: 320 }, drums, .1, { running: true, arcade: true, motion });
    drawFretted(context, width, 320, guitar, .1, false, { arcade: true, motion });
    drawArcadeBackdrop(context, width, 320, .1, { motion }); drawArcadeBurst(context, 20, 50, '#abc', .1, { motion });
  }
  assert.deepEqual(drums, original); assert.equal(arcadePulse(0, false), arcadePulse(50, false));
  for (let t = 0; t < 4; t += .02) assert.ok(arcadePulse(t) >= .44 && arcadePulse(t) <= 1);
});
