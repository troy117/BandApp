import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, Judge, GROOVES } from '../dist/engine.mjs';
import { createNotation, sheetGeometry, nextHitGroup, scoreBeatAtTime, STAFF_POSITIONS } from '../dist/notation.mjs';
import { createPracticeChart } from '../dist/practice.mjs';
import { makeMidiChart, parseMidiSong, buildTimeline } from '../dist/midi.mjs';
import { createDemoMidi } from '../dist/demo-data.mjs';

test('all built-in scores preserve every onset and simultaneous drum at every tempo', () => {
  for (const groove of Object.keys(GROOVES)) for (const bpm of [40, 80, 160]) for (const bars of [4, 8, 16]) {
    const chart = createChart(groove, bpm, bars);
    const score = createNotation(chart);
    assert.deepEqual(score.groups.flatMap(group => group.notes.map(note => note.id)), chart.notes.map(note => note.id));
    assert.equal(score.groups.reduce((beats, group) => beats + group.durationBeats, 0), bars * 4);
    for (const group of score.groups) {
      assert.ok(Math.abs(group.time - group.beat * score.secondsPerBeat) < 1e-7);
      assert.ok([1, 0.5, 0.25].includes(group.durationBeats));
      if (group.beamNext) assert.equal(Math.floor(group.beat), Math.floor(score.groups[score.groups.indexOf(group) + 1].beat));
      for (const note of group.notes) assert.ok(Number.isFinite(STAFF_POSITIONS[note.drum]));
    }
    if (['rock', 'floor', 'backbeat'].includes(groove)) assert.equal(score.groups.filter(group => group.beamNext).length, groove === 'backbeat' ? 0 : bars * 4);
  }
});
test('focus notation fills silent beats with rests and preserves isolated offbeat notes', () => {
  const kick = createNotation(createPracticeChart(createChart('rock', 80, 4), { focus: 'kick' }));
  assert.equal(kick.groups.length, 16);
  assert.equal(kick.groups.filter(group => group.rest).length, 8);
  const hats = createNotation(createPracticeChart(createChart('offbeathat', 80, 4), { focus: 'cymbals' }));
  assert.equal(hats.groups.length, 32);
  assert.equal(hats.groups.filter(group => group.rest).length, 16);
  assert.equal(hats.groups[1].beat, 0.5);
  assert.equal(hats.groups[1].beamBack, false);
  assert.equal(Boolean(hats.groups[1].beamNext), false);
});
test('sheet playhead stays on every onset while tempo rises between passes', () => {
  const chart = createPracticeChart(createChart('kickpickup', 80, 4), { enabled: true, startBar: 2, endBar: 3, repeats: 4, stepUp: true });
  const score = createNotation(chart);
  assert.equal(score.subdivisions, 4);
  for (const group of score.groups) assert.ok(Math.abs(scoreBeatAtTime(score, group.time) - group.beat) < 1e-7);
});
test('notation reads live judge results without changing timing or consuming notes', () => {
  const judge = new Judge(createChart('rock', 80, 4));
  const score = createNotation(judge.chart);
  const simultaneous = score.groups[0];
  assert.deepEqual(simultaneous.notes.map(note => note.drum), ['kick', 'hihat']);
  judge.strike('kick', 0.03);
  assert.equal(simultaneous.notes.find(note => note.drum === 'kick').status, 'hit');
  assert.equal(simultaneous.notes.find(note => note.drum === 'hihat').status, 'pending');
  assert.equal(judge.summary().hits, 1);
  assert.equal(judge.chart.notes.find(note => note.drum === 'kick').errorMs, 30);
  assert.equal(createNotation({ kind: 'midi' }), null);
});
test('scrolling score keeps its playhead aligned with note onsets across widths and measure boundaries', () => {
  for (const width of [320, 480, 800, 1100]) for (const total of [16, 32, 64]) {
    let previousScroll = 0;
    for (let beat = 0; beat <= total; beat += 0.5) {
      const g = sheetGeometry(width, 347, total, beat);
      assert.ok(Math.abs(g.playhead - g.x(beat)) < 1e-7);
      assert.ok(g.playhead >= g.gutter && g.playhead <= g.right + 1e-7);
      assert.ok(g.scroll >= previousScroll);
      previousScroll = g.scroll;
    }
  }
});
test('upcoming hit cues group simultaneous voices, respect due timing, and end cleanly', () => {
  const chart = createChart('rock', 80, 4);
  assert.equal(nextHitGroup(chart, -2).due, false);
  assert.deepEqual(nextHitGroup(chart, -2).notes.map(note => note.drum), ['kick', 'hihat']);
  assert.equal(nextHitGroup(chart, 0).due, true);
  assert.equal(nextHitGroup(chart, 0.1).time, 0);
  assert.equal(nextHitGroup(chart, 0.12).time, 0.375);
  assert.equal(nextHitGroup(chart, chart.duration), null);
});

test('imported sheet music preserves all notes, musical coordinates, and tempo-changing cursor', () => {
  const song = parseMidiSong(createDemoMidi()), source = makeMidiChart(song, song.selected);
  const before = structuredClone(source), score = createNotation(source);
  assert.equal(score.measures.length, 4);
  assert.deepEqual(score.groups.flatMap(group => group.notes.map(note => note.id)), source.notes.map(note => note.id));
  for (const note of source.notes) assert.ok(Math.abs(scoreBeatAtTime(score, note.time) - note.quarter) < 1e-7);
  assert.deepEqual(source, before);
  const focused = createPracticeChart(source, { enabled: true, startBar: 2, endBar: 3, repeats: 2, focus: 'kick' });
  const loopScore = createNotation(focused);
  assert.deepEqual(loopScore.measures.map(m => [m.sourceBar, m.pass]), [[2, 1], [3, 1], [2, 2], [3, 2]]);
  assert.ok(loopScore.groups.every(group => group.notes.every(note => note.drum === 'kick')));
  assert.ok(loopScore.groups.some(group => group.rest));
  for (const note of focused.notes) assert.ok(Math.abs(scoreBeatAtTime(loopScore, note.time) - note.quarter) < 1e-7);
});

test('MIDI sheet music supports triplets, 32nds, silent measures, meter changes, and a partial last bar', () => {
  const timeline = buildTimeline(480, [{ tick: 400, microsecondsPerBeat: 600000 }], [{ tick: 1920, numerator: 6, denominator: 8 }, { tick: 3360, numerator: 3, denominator: 4 }]);
  const ticks = [0, 160, 320, 480, 540, 600, 660, 720, 1920, 2160, 2400, 2640, 2880, 3120, 3600];
  const song = { title: 'Rhythm fixture', ppq: 480, endTick: 3720, duration: timeline.tickToSeconds(3720), timeline, parts: [{ id: '0:9', notes: ticks.map(tick => ({ tick, pitch: 36, velocity: 100 })) }] };
  const chart = makeMidiChart(song, ['0:9']), score = createNotation(chart);
  assert.deepEqual(score.measures.map(m => [m.numerator, m.denominator]), [[4, 4], [6, 8], [3, 4]]);
  assert.ok(score.groups.some(group => group.tuplet && Math.abs(group.durationBeats - 1 / 3) < 1e-7));
  assert.ok(score.groups.some(group => group.durationBeats === 0.125));
  assert.equal(score.groups.flatMap(group => group.notes).length, ticks.length);
  assert.ok(Math.abs(score.groups.reduce((sum, group) => sum + group.durationBeats, 0) - 7.75) < 1e-7);
  for (const note of chart.notes) assert.ok(Math.abs(scoreBeatAtTime(score, note.time) - note.quarter) < 1e-7);
  const loop = createPracticeChart(chart, { enabled: true, startBar: 2, endBar: 3, repeats: 2 });
  const repeatScore = createNotation(loop);
  assert.equal(repeatScore.totalBeats, 7.5);
  for (const note of loop.notes) assert.ok(Math.abs(scoreBeatAtTime(repeatScore, note.time) - note.quarter) < 1e-7);
});

test('display rounding for expressive MIDI never changes the notes or scoring clock', () => {
  const timeline = buildTimeline(480, [], []);
  const song = { title: 'Expressive fixture', ppq: 480, endTick: 1920, duration: 2, timeline, parts: [{ id: '0:9', notes: [0, 247, 486].map(tick => ({ tick, pitch: 38, velocity: 100 })) }] };
  const source = makeMidiChart(song, ['0:9']), before = structuredClone(source), score = createNotation(source);
  assert.ok(score.approximate); assert.deepEqual(source, before);
  assert.equal(score.groups.flatMap(group => group.notes).length, 3);
  const judge = new Judge(source);
  for (const note of source.notes) judge.strike(note.drum, note.time);
  assert.equal(judge.summary().hits, 3);
});
