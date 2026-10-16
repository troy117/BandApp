import test from 'node:test';
import assert from 'node:assert/strict';
import { alignMidiChart, fitAlignment, midiPositionTime, audioOnsets, suggestAlignment, validateAlignment, waveformNotes } from '../dist/sync.mjs';
import { parseMidiSong, makeMidiChart } from '../dist/midi.mjs';
import { createDemoMidi } from '../dist/demo-data.mjs';
import { createPracticeChart, backingSegments } from '../dist/practice.mjs';
import { createNotation, scoreBeatAtTime } from '../dist/notation.mjs';

const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const sampleChart = () => { const song = parseMidiSong(createDemoMidi()); return makeMidiChart(song, song.selected); };

test('waveform overlay uses the recording clock for offset, speed, zoom and simultaneous voices', () => {
  const chart = sampleChart(), before = structuredClone(chart);
  const view = { start: 2, duration: 2, left: 54, width: 600 };
  const alignment = { offset: -0.5, timeScale: 1.05 };
  const hits = waveformNotes(chart, alignment, view);
  assert.ok(hits.length > 0);
  for (const hit of hits) {
    close(hit.audioTime, hit.note.time * 1.05 + 0.5);
    close((hit.x - view.left) / view.width * view.duration + view.start, hit.audioTime);
    assert.ok(hit.x >= 54 && hit.x < 654);
  }
  const beginning = waveformNotes(chart, { offset: 0, timeScale: 1 }, { ...view, start: 0 });
  const simultaneous = beginning.filter(hit => hit.audioTime === 0);
  assert.ok(simultaneous.length > 1); assert.equal(new Set(simultaneous.map(hit => hit.x)).size, 1);
  assert.equal(new Set(simultaneous.map(hit => hit.note.drum)).size, simultaneous.length);
  const delayed = waveformNotes(chart, { offset: 1, timeScale: 1 }, { ...view, start: 0 });
  assert.ok(delayed.every(hit => hit.note.time >= 1));
  const zoom = waveformNotes(chart, { offset: 0, timeScale: 1 }, { ...view, start: 0, duration: 0.5 });
  assert.ok(zoom.every(hit => hit.audioTime < 0.5));
  const nudged = waveformNotes(chart, { offset: -0.05, timeScale: 1 }, { ...view, start: 0 });
  close(nudged[0].x - beginning[0].x, 15);
  assert.deepEqual(chart, before);
  assert.throws(() => waveformNotes(chart, alignment, { ...view, duration: 0 }), /waveform window/);
});

test('one and two beat matches fit both offset signs and steady tempo drift', () => {
  assert.deepEqual(fitAlignment({ midi: 0, audio: 2.5 }), { offset: -2.5, timeScale: 1 });
  assert.deepEqual(fitAlignment({ midi: 4, audio: 1.5 }), { offset: 2.5, timeScale: 1 });
  const fit = fitAlignment({ midi: 10, audio: 13.5 }, { midi: 110, audio: 118.5 });
  close(fit.timeScale, 1.05); close(fit.offset, -3);
  for (const midi of [10, 110]) close(midi * fit.timeScale - fit.offset, midi === 10 ? 13.5 : 118.5);
  assert.throws(() => fitAlignment({ midi: 0, audio: 1 }, { midi: 2, audio: 2 }), /second match/);
  assert.throws(() => fitAlignment({ midi: 0, audio: -1 }), /valid matching/);
  assert.throws(() => validateAlignment(301, 1), /offset/);
  assert.throws(() => validateAlignment(0, NaN), /MIDI speed/);
  assert.throws(() => validateAlignment(0, 2.1), /MIDI speed/);
});

test('retimed MIDI preserves musical positions and internal tempo changes through loops', () => {
  const source = sampleChart(), before = structuredClone(source), aligned = alignMidiChart(source, 1.05);
  close(aligned.duration, source.duration * 1.05); close(aligned.bpm, 120 / 1.05);
  close(midiPositionTime(source, 3, 2), 4.6);
  assert.throws(() => midiPositionTime(source, 5, 1), /bar and beat/);
  assert.throws(() => midiPositionTime(source, 1, 5), /bar and beat/);
  for (const [i, note] of aligned.notes.entries()) { close(note.time, source.notes[i].time * 1.05); assert.equal(note.quarter, source.notes[i].quarter); }
  assert.deepEqual(source, before);
  const loop = createPracticeChart(aligned, { enabled: true, startBar: 2, endBar: 3, repeats: 2 });
  close(loop.duration, 8.8 * 1.05);
  const segments = backingSegments(loop, { buffer: { duration: 30 }, offset: -2 });
  close(segments[0].offset, 2 * 1.05 + 2); close(segments[0].duration, 4.4 * 1.05);
  const notation = createNotation(loop);
  assert.equal(notation.measures.length, 4);
  for (const note of loop.notes) close(scoreBeatAtTime(notation, note.time), note.quarter);
});

const syntheticChart = () => ({ notes: Array.from({ length: 180 }, (_, i) => ({ time: i * 0.53 + ((i * 17) % 7) * 0.033, drum: i % 3 ? 'snare' : 'kick' })) });
function featuresFor(chart, offset, timeScale) {
  const duration = Math.max(120, chart.notes.at(-1).time * timeScale - offset + 1);
  const envelope = new Float32Array(Math.ceil(duration * 100)).fill(-0.2);
  for (const note of chart.notes) {
    const at = Math.round((note.time * timeScale - offset) * 100);
    for (let d = -2; d <= 2; d++) if (at + d >= 0 && at + d < envelope.length) envelope[at + d] = 5 - Math.abs(d);
  }
  return { envelope, rate: 100, duration };
}
test('automatic matching finds a delayed recording without guessing tempo changes', async () => {
  const chart = syntheticChart();
  const results = await suggestAlignment(chart, featuresFor(chart, -2.37, 1), { drift: false, window: 12 });
  close(results[0].offset, -2.37, 0.02); assert.equal(results[0].timeScale, 1);
});
test('automatic matching can suggest both a start shift and a steady speed difference', async () => {
  const chart = syntheticChart();
  const results = await suggestAlignment(chart, featuresFor(chart, -1.27, 1.05263), { window: 12 });
  close(results[0].timeScale, 1.05263, 0.0011); close(results[0].offset, -1.27, 0.04);
});
test('automatic matching rejects sparse MIDI, unrelated or silent features, and cancellation', async () => {
  const chart = syntheticChart();
  await assert.rejects(suggestAlignment({ notes: chart.notes.slice(0, 3) }, featuresFor(chart, 0, 1)), /eight/);
  await assert.rejects(suggestAlignment(chart, { envelope: new Float32Array(12000), rate: 100 }, { drift: false, window: 12 }), /No convincing match/);
  await assert.rejects(suggestAlignment(chart, featuresFor(chart, 0, 1), { cancelled: () => true }), /cancelled/);
});
test('multiband audio analysis detects attacks in anti-phase stereo and rejects silence', async () => {
  const rate = 11025, data = new Float32Array(rate * 5);
  for (const second of [0.5, 1.23, 2.11, 3.79]) for (let i = 0; i < 800; i++) data[Math.floor(second * rate) + i] = Math.sin(i * 0.8) * Math.exp(-i / 150) * 0.6;
  const buffer = { sampleRate: rate, length: data.length, duration: 5, numberOfChannels: 2, getChannelData: c => c ? data.map(value => -value) : data };
  const features = await audioOnsets(buffer);
  for (const second of [0.5, 1.23, 2.11, 3.79]) assert.ok(features.envelope[Math.round(second * 100)] > 1);
  await assert.rejects(audioOnsets({ ...buffer, getChannelData: () => new Float32Array(data.length) }), /no clear attacks/);
  await assert.rejects(audioOnsets(buffer, { cancelled: () => true }), /cancelled/);
});

test('audio analysis and MIDI matching work together over a synthetic music bed', async () => {
  const chart = syntheticChart(), rate = 11025, offset = -1.72, timeScale = 1.05;
  const data = new Float32Array(rate * 105);
  for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 2 * Math.PI * 110 / rate) * 0.04;
  for (const note of chart.notes) {
    const at = Math.floor((note.time * timeScale - offset) * rate);
    for (let i = 0; i < 700; i++) data[at + i] += Math.sin(i * (note.drum === 'kick' ? 0.08 : 1.7)) * Math.exp(-i / 130) * 0.65;
  }
  const buffer = { sampleRate: rate, length: data.length, duration: 105, numberOfChannels: 1, getChannelData: () => data };
  const features = await audioOnsets(buffer);
  const results = await suggestAlignment(chart, features, { window: 12 });
  close(results[0].timeScale, timeScale, 0.0011); close(results[0].offset, offset, 0.04);
});

test('duration matching stays accurate on a four-minute pattern', async () => {
  const chart = { notes: Array.from({ length: 470 }, (_, i) => ({ time: i * 0.5 + ((i * i * 13) % 79) / 1000, drum: 'kick' })) };
  const results = await suggestAlignment(chart, featuresFor(chart, -2.54, 1.05263), { window: 12 });
  close(results[0].timeScale, 1.05263, 0.0003); close(results[0].offset, -2.54, 0.04);
});
