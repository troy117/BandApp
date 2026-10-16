import test from 'node:test';
import assert from 'node:assert/strict';
import { GROOVES, DRUMS, createChart, Judge } from '../dist/engine.mjs';
import { createPracticeChart, backingSegments, passSummaries, savePracticeHistory } from '../dist/practice.mjs';
import { parseMidiSong, makeMidiChart } from '../dist/midi.mjs';
import { createDemoMidi } from '../dist/demo-data.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const loop = { enabled: true, startBar: 2, endBar: 3, repeats: 4 };

test('24 original tracks span four levels and valid, distinct four-bar patterns', () => {
  assert.equal(Object.keys(GROOVES).length, 24);
  const distinct = new Set(), drums = new Set();
  for (const level of [1, 2, 3, 4]) assert.equal(Object.values(GROOVES).filter(track => track.level === level).length, 6);
  for (const [id, track] of Object.entries(GROOVES)) {
    const chart = createChart(id, track.bpm, 4);
    assert.ok(chart.notes.length > 0);
    assert.equal(new Set(chart.notes.map(note => note.id)).size, chart.notes.length);
    distinct.add(JSON.stringify(chart.notes.map(note => [note.drum, note.bar, note.beat])));
    for (const note of chart.notes) {
      assert.ok(note.time >= 0 && note.time < chart.duration);
      assert.ok(note.beat >= 1 && note.beat < 5);
      assert.ok(Number.isInteger((note.beat - 1) * 4)); drums.add(note.drum);
    }
  }
  assert.equal(distinct.size, 24);
  assert.deepEqual([...drums].sort(), DRUMS.map(drum => drum.id).sort());
});
test('section repeats include the selected bars, reset their origin, and keep source data intact', () => {
  const source = createChart('rock', 120, 4), before = structuredClone(source);
  const chart = createPracticeChart(source, loop);
  assert.equal(chart.notes.length, 96); assert.equal(chart.bars, 8); assert.equal(chart.duration, 16);
  assert.deepEqual(chart.passes.map(pass => pass.time), [0, 4, 8, 12]);
  assert.equal(chart.notes[0].time, 0); assert.equal(chart.notes[0].sourceBar, 2);
  assert.deepEqual([...new Set(chart.notes.map(note => note.sourceBar))], [2, 3]);
  assert.equal(new Set(chart.notes.map(note => note.id)).size, 96);
  assert.deepEqual(source, before);
  const judge = new Judge(chart);
  for (const note of chart.notes) judge.strike(note.drum, note.time);
  judge.advance(Infinity); assert.equal(judge.summary().accuracy, 100);
});
test('tempo builder schedules continuous passes exactly and caps the tempo', () => {
  const chart = createPracticeChart(createChart('rock', 80, 4), { ...loop, startBar: 1, endBar: 1, stepUp: true });
  assert.deepEqual(chart.passes.map(pass => pass.bpm), [80, 85, 90, 95]);
  let cursor = 0;
  for (const pass of chart.passes) {
    near(pass.time, cursor); near(pass.duration, 240 / pass.bpm);
    assert.equal(chart.notes.find(note => note.pass === pass.index).time, pass.time);
    cursor += pass.duration;
  }
  near(chart.duration, cursor);
  const capped = createPracticeChart(createChart('rock', 155, 4), { ...loop, stepUp: true });
  assert.deepEqual(capped.passes.map(pass => pass.bpm), [155, 160, 160, 160]);
  const fast = createPracticeChart(createChart('rock', 200, 4));
  assert.equal(fast.passes[0].bpm, 200); near(fast.duration, 4.8);
});
test('focus filters only the scored voices and rejects silent selections', () => {
  const source = createChart('rock', 80, 4);
  const focused = createPracticeChart(source, { focus: 'snare' });
  assert.equal(focused.notes.length, 8); assert.ok(focused.notes.every(note => note.drum === 'snare'));
  assert.deepEqual(focused.focusDrums, ['snare']);
  assert.throws(() => createPracticeChart(source, { focus: 'toms' }), /No toms hits/);
  assert.throws(() => createPracticeChart(source, { ...loop, startBar: 4, endBar: 2 }), /valid start/);
  assert.throws(() => createPracticeChart(source, { ...loop, repeats: 3 }), /valid start/);
  assert.throws(() => createPracticeChart(source, { ...loop, startBar: 1.5 }), /valid start/);
  assert.throws(() => createPracticeChart(createChart('rock', 40, 32), { enabled: true, startBar: 1, endBar: 32, repeats: 8 }), /20 minutes/);
});
test('MIDI loops preserve internal tempo changes and restart each pass at the section tempo', () => {
  const song = parseMidiSong(createDemoMidi());
  const source = makeMidiChart(song, song.selected);
  const chart = createPracticeChart(source, { ...loop, repeats: 2, stepUp: true });
  near(chart.passes[0].from, 2); near(chart.passes[0].to, 6.4); near(chart.duration, 8.8);
  assert.deepEqual(chart.tempos.map(tempo => tempo.bpm), [120, 100, 120, 100]);
  near(chart.tempos[1].time, 2); near(chart.tempos[2].time, 4.4);
  assert.equal(chart.notes[0].bar, 1); assert.equal(chart.notes[0].sourceBar, 2);
  assert.equal(chart.practice.increment, 0);
});
test('backing segments crop the right recording interval with either alignment direction', () => {
  const chart = createPracticeChart(createChart('rock', 120, 4), { ...loop, repeats: 2 });
  const positive = backingSegments(chart, { buffer: { duration: 20 }, offset: 0.25 });
  assert.deepEqual(positive, [{ when: 0, offset: 1.75, duration: 4 }, { when: 4, offset: 1.75, duration: 4 }]);
  const negative = backingSegments(chart, { buffer: { duration: 20 }, offset: -1 });
  assert.equal(negative[0].offset, 3);
  const opening = createPracticeChart(createChart('rock', 120, 4), { ...loop, startBar: 1, endBar: 1, repeats: 2 });
  assert.deepEqual(backingSegments(opening, { buffer: { duration: 20 }, offset: 0.5 }), [{ when: 0.5, offset: 0, duration: 1.5 }, { when: 2.5, offset: 0, duration: 1.5 }]);
  assert.deepEqual(backingSegments(opening, { buffer: { duration: 20 }, offset: 3 }), []);
  assert.equal(backingSegments(chart, { buffer: { duration: 2.5 }, offset: 0 })[0].duration, 0.5);
});
test('each pass report includes its own hits, misses, extras, tempo, and timing error', () => {
  const chart = createPracticeChart(createChart('backbeat', 120, 4), { ...loop, startBar: 1, endBar: 1, repeats: 2 });
  const judge = new Judge(chart);
  for (const note of chart.notes.filter(note => note.pass === 1)) judge.strike(note.drum, note.time + 0.02);
  judge.strike('ride', 2.2); judge.advance(Infinity);
  const reports = passSummaries(judge);
  assert.equal(reports[0].accuracy, 100); near(reports[0].meanAbsMs, 20);
  assert.equal(reports[1].accuracy, 0); assert.equal(reports[1].extras, 1); assert.equal(reports[1].meanAbsMs, null);
});
test('practice history is bounded, validates loaded records, and leaves previous entries unchanged', () => {
  const previous = Array.from({ length: 35 }, (_, n) => ({ at: n, title: 'Test', accuracy: 50 }));
  const record = { at: 100, title: 'Latest', accuracy: 80 };
  const history = savePracticeHistory(previous, record);
  assert.equal(history.length, 30); assert.equal(history[0], record); assert.equal(previous.length, 35);
  assert.equal(savePracticeHistory([null, { title: 'Bad' }], record).length, 1);
});
