import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLyricText, arrangementLyrics, lyricWordTimings } from '../dist/lyrics.mjs';
import { karaokeFrame } from '../dist/karaoke-view.mjs';
import { vocalHighwayWords } from '../dist/vocal-highway.mjs';

const text = 'WEBVTT\n\n00:00:01.000 --> 00:00:09.000\n<00:00:01.000>Hold<00:00:05.000> <00:00:07.000>on<00:00:09.000>\n';

test('saved word timestamps preserve held words and silent gaps in both vocal displays', () => {
  const cues = parseLyricText(text);
  assert.equal(cues[0].text, 'Hold on');
  assert.deepEqual(cues[0].words, [{ text: 'Hold', time: 1, end: 5 }, { text: 'on', time: 7, end: 9 }]);
  const chart = { bpm: 120, lyrics: cues };
  assert.deepEqual(karaokeFrame(chart, 3).fills, [.5, 0]);
  assert.deepEqual(karaokeFrame(chart, 6).fills, [1, 0]);
  assert.deepEqual(karaokeFrame(chart, 8).fills, [1, .5]);
  assert.deepEqual(vocalHighwayWords(cues), cues[0].words);
  assert.equal(karaokeFrame(chart, 6, false, true).fills, undefined);
});

test('word times follow the same recording offset and tempo changes as their lyric lines', () => {
  const cues = arrangementLyrics({duration: 30}, {lyricsText: text, timeScale: 2, lyricsOffset: -3});
  assert.equal(cues[0].time, 0);
  assert.deepEqual(cues[0].words, [{text:'Hold',time:0,end:7},{text:'on',time:11,end:15}]);
  const recording = arrangementLyrics({duration: 30}, {lyricsText: text, lyricsClock:'recording', offset: 4, lyricsOffset: .5, timeScale: 2});
  assert.equal(recording[0].words[0].time, 5.5);
  assert.equal(recording[0].words[1].end, 13.5);
});

test('invalid word timestamps are rejected and markup remains plain lyric text', () => {
  assert.throws(() => parseLyricText(text.replace('00:00:07.000', '00:00:04.000')), /increase/);
  assert.throws(() => parseLyricText(text.replace('00:00:07.000', '00:00:10.000')), /increase/);
  assert.equal(parseLyricText(text.replace('Hold', '<b>Hold</b>'))[0].text, 'Hold on');
});

test('line-only songs retain their approximate sweep and highway spacing', () => {
  const cue = {time: 1, end: 7, text:'One two'};
  assert.deepEqual(lyricWordTimings(cue), [{text:'One',time:1,end:4},{text:'two',time:4,end:7}]);
  assert.deepEqual(karaokeFrame({bpm:120,lyrics:[cue]}, 4).fills, [1,0]);
});
