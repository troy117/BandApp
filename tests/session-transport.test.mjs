import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangementFromBar } from '../dist/session-transport.mjs';
import { builtinArrangement, importedArrangement } from '../dist/arrangements.mjs';
import { parseMidiSong } from '../dist/midi.mjs';
import { ensembleMidi } from './ensemble-fixture.mjs';
import { backingSegments } from '../dist/practice.mjs';
import { drumHighwayLanes, drumHighwayLane } from '../dist/drum-lanes.mjs';
import { drawDrumHighway } from '../dist/drum-highway.mjs';

test('starting a band at a source bar aligns all parts, lyrics and backing without changing the song', () => {
  const source = builtinArrangement('band-first'), original = structuredClone(source);
  const sliced = arrangementFromBar(source, 3), from = 6;
  assert.deepEqual(source, original);
  assert.equal(sliced.duration, source.duration - from);
  for (const part of sliced.parts) {
    assert.equal(part.chart.beats[0].time, 0);
    assert.equal(part.chart.beats[0].sourceBar, 3);
    assert.equal(part.chart.practice.full, false);
    assert.equal(part.chart.sourceBars, 8);
    assert.ok(part.chart.notes.every(note => note.sourceBar >= 3 && note.time >= 0));
  }
  const vocals = sliced.parts.find(part => part.instrument === 'vocals');
  assert.deepEqual(vocals.chart.lyrics[0], { text: 'Keep it steady', time: 0, end: 6 });
  assert.deepEqual(backingSegments(sliced.parts[0].chart, { offset: -2, buffer: { duration: 100 } }), [{ when: 0, offset: 8, duration: 18 }]);
  assert.equal(arrangementFromBar(source, 1), source);
  for (const value of [0, 9, 1.5, '2', NaN]) assert.throws(() => arrangementFromBar(source, value), /start bar/);
});

test('late sections retain tempo changes and empty parts so every student can follow the transport', () => {
  const source = importedArrangement(parseMidiSong(ensembleMidi(), 'original.mid'), { selected: ['1:9'] });
  const sliced = arrangementFromBar(source, 2);
  assert.equal(sliced.parts[0].chart.bpm, 100);
  assert.equal(sliced.parts[0].chart.countInBeatSeconds, 0.6);
  assert.equal(sliced.parts[0].chart.notes.length, 0);
  assert.equal(sliced.parts[0].chart.beats[0].sourceBar, 2);
  assert.ok(sliced.duration > 0);
});

test('highway uses distinct scored hi-hat voices and preserves legacy lane order', () => {
  const chart = { notes: [{ drum: 'hihat', midiPitch: 42 }, { drum: 'hihat-open', midiPitch: 46 }, { drum: 'hihat-pedal', midiPitch: 44 }, { drum: 'hihat-open', midiPitch: 26 }, { drum: 'snare', midiPitch: 46 }] };
  assert.deepEqual(chart.notes.map(drumHighwayLane), ['hihat', 'hihat-open', 'hihat-pedal', 'hihat-open', 'snare']);
  const lanes = drumHighwayLanes(chart);
  assert.deepEqual(lanes.map(lane => lane.id), ['hihat', 'hihat-open', 'hihat-pedal', 'snare']);
  assert.equal(lanes[1].drumId, 'hihat-open');
  assert.equal(drumHighwayLanes({ notes: [{ drum: 'hihat' }] }).length, 1);
  const order = ['snare', 'kick', 'hihat', 'tom1', 'tom2', 'tom3', 'crash', 'ride'];
  assert.deepEqual(drumHighwayLanes(chart, order).map(lane => lane.id), ['snare', 'hihat', 'hihat-open', 'hihat-pedal']);
});

test('shared drum renderer draws labelled hi-hat boxes with finite geometry at narrow and wide sizes', () => {
  const chart = builtinArrangement().parts[0].chart;
  chart.notes[0] = { ...chart.notes[0], drum: 'hihat-open', midiPitch: 46 };
  const labels = [], context = new Proxy({}, { get: (_object, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...args) => {
    assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
    if (key === 'fillText') labels.push(args[0]);
  } });
  for (const width of [280, 1000]) for (const time of [-1, 0, 10]) drawDrumHighway(context, { width, height: 320 }, chart, time, { running: time >= 0 });
  assert.ok(labels.includes('OPEN HAT ○')); assert.ok(labels.includes('CLOSED HAT'));
});
