import test from 'node:test';
import assert from 'node:assert/strict';
import { vocalHighwayWords, vocalHighwayRange, vocalHighwayLayout, drawVocalHighway, VocalHighway } from '../dist/vocal-highway.mjs';

const chart = { notes: [{ pitch: 60, time: 1, duration: 4 }, { pitch: 67, time: 6, duration: 1 }], beats: [{ time: 1, downbeat: true, bar: 1 }], lyrics: [{ time: 1, end: 5, text: 'Hold this note' }] };
const context = () => new Proxy({}, { get: (_target, key) => key === 'measureText' ? text => ({ width: text.length * 7 }) : (...args) => assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value))) });

test('highway words retain supplied text and occupy only their saved line interval', () => {
  const words = vocalHighwayWords(chart.lyrics);
  assert.deepEqual(words.map(word => word.text), ['Hold', 'this', 'note']);
  assert.equal(words[0].time, 1); assert.equal(words.at(-1).end, 5);
  assert.ok(words.every(word => word.end > word.time)); assert.deepEqual(vocalHighwayWords([]), []);
});

test('pitch bars hold across the play line, higher pitches rise, and octave shifts preserve timing', () => {
  const frame = vocalHighwayLayout(chart, 2, 900, 230);
  const held = frame.notes[0]; assert.ok(held.x < frame.playX && held.endX > frame.playX); assert.equal(held.active, true);
  assert.ok(frame.notes[1].y < held.y);
  const shifted = vocalHighwayLayout(chart, 2, 900, 230, { shift: 12 });
  assert.equal(shifted.notes[0].pitch, 72); assert.equal(shifted.notes[0].x, held.x); assert.equal(shifted.notes[0].endX, held.endX);
  assert.deepEqual(vocalHighwayRange([], 0), { low: 55, high: 72 });
});

test('vocal highway renders phones, wide screens, rests and song ends without mutating cues', () => {
  const before = structuredClone(chart), ctx = context();
  for (const width of [180, 300, 1100]) for (const time of [-4, 0, 2, 5.5, 50]) {
    const frame = vocalHighwayLayout(chart, time, width, 210);
    drawVocalHighway(ctx, width, 210, frame, [{ time: time - .1, pitch: 60.2, onPitch: true }]);
  }
  drawVocalHighway(ctx, 300, 210, vocalHighwayLayout({ notes: [], lyrics: [], beats: [] }, 0, 300, 210));
  assert.deepEqual(chart, before);
});

test('live trace records measured voice only and clears old evidence after seeking or changing octave', () => {
  const ctx = context(), canvas = { getBoundingClientRect: () => ({ width: 300, height: 210 }), getContext: () => ctx };
  const highway = new VocalHighway(canvas), feedback = { state: 'on-pitch', cents: 10 };
  highway.draw(chart, 2, { playing: true, sampleTime: 1.9, feedback }); assert.equal(highway.history.length, 1); assert.equal(highway.history[0].pitch, 60.1);
  highway.draw(chart, 2.1, { playing: true, feedback: { cents: null } }); assert.equal(highway.history.length, 1);
  highway.draw(chart, 2.2, { playing: false, feedback }); assert.equal(highway.history.length, 1);
  highway.draw(chart, 1, { playing: false }); assert.equal(highway.history.length, 0);
  highway.draw(chart, 2, { shift: 12, playing: true, sampleTime: 1.9, feedback }); assert.equal(highway.history[0].pitch, 72.1);
  highway.reset(); assert.equal(highway.history.length, 0);
});
