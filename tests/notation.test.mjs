import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, Judge, GROOVES } from '../dist/engine.mjs';
import { createNotation, sheetGeometry, nextHitGroup } from '../dist/notation.mjs';

test('all built-in scores preserve every onset and simultaneous drum at every tempo', () => {
  for (const groove of Object.keys(GROOVES)) for (const bpm of [40, 80, 160]) for (const bars of [4, 8, 16]) {
    const chart = createChart(groove, bpm, bars);
    const score = createNotation(chart);
    assert.deepEqual(score.groups.flatMap(group => group.notes.map(note => note.id)), chart.notes.map(note => note.id));
    assert.equal(score.groups.reduce((beats, group) => beats + group.durationBeats, 0), bars * 4);
    for (const group of score.groups) {
      assert.ok(Math.abs(group.time - group.beat * score.secondsPerBeat) < 1e-7);
      assert.equal(group.durationBeats, groove === 'backbeat' ? 1 : 0.5);
      if (group.beamNext) assert.equal(group.beat % 1, 0);
    }
    assert.equal(score.groups.filter(group => group.beamNext).length, groove === 'backbeat' ? 0 : bars * 4);
  }
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
