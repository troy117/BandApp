import test from 'node:test';
import assert from 'node:assert/strict';
import { karaokeFrame, karaokeWordFills } from '../dist/karaoke-view.mjs';

test('karaoke previews two musical bars before an entrance across tempo and meter changes', () => {
  const measures = [
    { time: 0, endTime: 2, startQuarter: 0, endQuarter: 4 },
    { time: 2, endTime: 5, startQuarter: 4, endQuarter: 7 },
    { time: 5, endTime: 6.5, startQuarter: 7, endQuarter: 10 },
    { time: 6.5, endTime: 10.5, startQuarter: 10, endQuarter: 14 },
  ];
  const beats = measures.flatMap(m => Array.from({ length: m.endQuarter - m.startQuarter }, (_, i) => ({ time: m.time + i * (m.endTime - m.time) / (m.endQuarter - m.startQuarter), quarter: m.startQuarter + i })));
  const chart = { bpm: 120, measures, beats, lyrics: [{ time: 8.5, end: 9.5, text: 'Come back in' }, { time: 10, end: 10.5, text: 'Then sing together' }] };
  assert.equal(karaokeFrame(chart, 3.49).phase, 'instrumental');
  const preview = karaokeFrame(chart, 3.5);
  assert.equal(preview.phase, 'preview'); assert.equal(preview.line, 'Come back in'); assert.equal(preview.next, 'Then sing together'); assert.equal(preview.progress, 0);
  assert.equal(karaokeFrame(chart, 8.5).phase, 'singing');
  assert.equal(karaokeFrame(chart, 9).progress, .5);
  assert.equal(karaokeFrame(chart, 9.5).phase, 'preview');
  assert.equal(karaokeFrame(chart, 10.5).phase, 'ended');
});

test('ready lyrics stay white, long instrumental gaps withhold text, and restarted sections reset the sweep', () => {
  const chart = { bpm: 120, numerator: 4, denominator: 4, lyrics: [{ time: 60, end: 64, text: 'Sing this line' }] };
  assert.equal(karaokeFrame(chart, -.5, false).line, 'Sing this line');
  assert.equal(karaokeFrame(chart, -.5, false).progress, 0);
  assert.equal(karaokeFrame(chart, 40).phase, 'instrumental');
  assert.equal(karaokeFrame(chart, 55.99).phase, 'instrumental');
  assert.equal(karaokeFrame(chart, 56).phase, 'preview');
  assert.equal(karaokeFrame(chart, 63).progress, .75);
  assert.equal(karaokeFrame(chart, 60).progress, 0);
  assert.equal(karaokeFrame({ bpm: 80, lyrics: [] }, 0).phase, 'ended');
});

test('the yellow sweep advances in reading order across wrapped words and respects line boundaries', () => {
  const line = 'Sing now\nSing again';
  assert.deepEqual(karaokeWordFills(line, 0), [0, 0, 0, 0]);
  assert.deepEqual(karaokeWordFills(line, 1), [1, 1, 1, 1]);
  const fills = karaokeWordFills(line, .5);
  assert.equal(fills[0], 1); assert.equal(fills[1], 1); assert(fills[2] > 0 && fills[2] < 1); assert.equal(fills[3], 0);
  assert.deepEqual(karaokeWordFills('one word', -1), [0, 0]);
  assert.deepEqual(karaokeWordFills('one word', 2), [1, 1]);
});
