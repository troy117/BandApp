import test from 'node:test';
import assert from 'node:assert/strict';
import { plainLyricLines, markedLyricText } from '../dist/lyric-timing.mjs';
import { parseLyricText, currentLyric } from '../dist/lyrics.mjs';

test('line marks preserve supplied words and explicit instrumental gaps in portable timed text', () => {
  const lines = plainLyricLines('Find the beat\n\nPlay together');
  const text = markedLyricText(lines, [{ time: 2, end: 4 }, { time: 10 }], 20);
  const cues = parseLyricText(text);
  assert.deepEqual(cues, [{ time: 2, end: 4, text: 'Find the beat' }, { time: 10, end: 18, text: 'Play together' }]);
  assert.equal(currentLyric(cues, 6).current, null);
  assert.throws(() => markedLyricText(lines, [{ time: 2 }], 20), /every lyric line/);
  assert.throws(() => markedLyricText(lines, [{ time: 2, end: 12 }, { time: 10 }], 20), /in order/);
  assert.throws(() => markedLyricText(lines, [{ time: 11 }, { time: 10 }], 20), /in order/);
  assert.throws(() => plainLyricLines(''), /one short lyric line/);
});
