import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMidiSong, makeMidiChart, buildTimeline, backingSchedule, pitchChoices } from '../dist/midi.mjs';
import { createDemoMidi, createDemoWav } from '../dist/demo-data.mjs';
import { activeDrums, Judge } from '../dist/engine.mjs';
import { DrumAudio } from '../dist/audio.mjs';

const text = value => [...new TextEncoder().encode(value)];
const u16 = value => [value >> 8 & 255, value & 255];
const u32 = value => [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255];
const vlq = value => { const bytes = [value & 127]; while ((value >>>= 7)) bytes.unshift((value & 127) | 128); return bytes; };
const chunk = (name, bytes) => [...text(name), ...u32(bytes.length), ...bytes];
const smf = (tracks, format = 1, division = 480) => new Uint8Array([...chunk('MThd', [...u16(format), ...u16(tracks.length), ...u16(division)]), ...tracks.flatMap(bytes => chunk('MTrk', bytes))]);
const eot = [0, 255, 47, 0];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('sample MIDI chooses percussion, excludes bass, and preserves the tempo change', () => {
  const song = parseMidiSong(createDemoMidi(), 'Sample.mid');
  assert.equal(song.parts.length, 2);
  assert.deepEqual(song.selected, ['1:9']);
  const chart = makeMidiChart(song, song.selected);
  assert.equal(chart.notes.length, 50);
  assert.equal(chart.tempoChanges, 1);
  assert.equal(chart.bars, 4);
  near(chart.duration, 8.8);
  near(chart.notes.find(note => note.tick === 3840).time, 4);
  near(chart.notes.find(note => note.tick === 4320).time, 4.6);
  assert.equal(activeDrums(chart).length, 8);
});
test('MIDI tempo conversion and its inverse agree on both sides of changes', () => {
  const timeline = buildTimeline(480, [{ tick: 960, microsecondsPerBeat: 1000000 }], []);
  near(timeline.tickToSeconds(480), 0.5);
  near(timeline.tickToSeconds(1440), 2);
  for (const tick of [0, 240, 959, 960, 1440, 3000]) near(timeline.secondsToTick(timeline.tickToSeconds(tick)), tick);
});
test('meter changes keep measure numbers and denominator beats', () => {
  const timeline = buildTimeline(480, [], [{ tick: 1920, numerator: 3, denominator: 4 }, { tick: 3360, numerator: 6, denominator: 8 }]);
  assert.equal(timeline.position(1920).bar, 2);
  assert.equal(timeline.position(3360).bar, 3);
  assert.equal(timeline.position(3600).beat, 2);
});
test('type-0 running-status notes and velocity-zero note-offs are parsed correctly', () => {
  const song = parseMidiSong(smf([[0, 153, 36, 100, ...vlq(240), 36, 0, ...vlq(240), 38, 100, ...vlq(240), 38, 0, ...eot]], 0));
  const chart = makeMidiChart(song, song.selected);
  assert.deepEqual(chart.notes.map(note => note.drum), ['kick', 'snare']);
  near(chart.notes[1].time, 0.5);
});
test('custom assignments and ignored notes are explicit; simultaneous equivalent hits combine', () => {
  const song = parseMidiSong(smf([[0, 153, 36, 100, 0, 153, 35, 100, 0, 153, 60, 100, ...vlq(480), 255, 47, 0]]));
  assert.equal(pitchChoices(song, song.selected).find(item => item.pitch === 60).defaultDrum, 'ignore');
  const chart = makeMidiChart(song, song.selected, { 60: 'ride' });
  assert.equal(chart.notes.length, 2);
  assert.equal(chart.combined, 1);
  assert.equal(makeMidiChart(song, song.selected).ignored, 1);
  assert.throws(() => makeMidiChart(song, [], {}), /Select at least one/);
  assert.throws(() => makeMidiChart(song, song.selected, { 36: 'ignore', 35: 'ignore', 60: 'ignore' }), /No drum hits/);
});
test('3/8 import gets a three-eighth-note count-in and metronome grid', () => {
  const song = parseMidiSong(smf([[0, 255, 88, 4, 3, 3, 24, 8, 0, 153, 36, 100, ...vlq(720), 255, 47, 0]]));
  const chart = makeMidiChart(song, song.selected);
  assert.equal(chart.countInBeats, 3);
  near(chart.countInBeatSeconds, 0.25);
  assert.deepEqual(chart.beats.map(beat => beat.time), [0, 0.25, 0.5]);
});
test('imported notes use the same one-to-one judge and signed timing report', () => {
  const song = parseMidiSong(createDemoMidi());
  const judge = new Judge(makeMidiChart(song, song.selected));
  const crash = judge.strike('crash', -0.04);
  assert.equal(crash.type, 'hit'); near(crash.errorMs, -40);
  judge.advance(Infinity);
  assert.equal(judge.summary().misses, 49);
});
test('bad headers, truncation, invalid event lengths, and unsupported clocks are rejected', () => {
  assert.throws(() => parseMidiSong(new Uint8Array(40)), /not a standard MIDI/);
  const truncated = createDemoMidi().slice(0, -5);
  assert.throws(() => parseMidiSong(truncated), /Could not read/);
  assert.throws(() => parseMidiSong(smf([[0, 255, 1, 127, 0]])), /Invalid MIDI event/);
  assert.throws(() => parseMidiSong(smf([[0, 153, 36, 100, ...eot]], 2)), /format 2/);
  assert.throws(() => parseMidiSong(smf([[0, 153, 36, 100, ...eot]], 0, 0xe728)), /SMPTE/);
  assert.throws(() => parseMidiSong(smf([[0, 255, 81, 3, 0, 0, 0, 0, 153, 36, 100, ...eot]])), /tempo/);
});
test('backing alignment delays positive offsets and skips negative offsets exactly', () => {
  assert.deepEqual(backingSchedule(10, 2, 30), { when: 12, offset: 0 });
  assert.deepEqual(backingSchedule(10, -2, 30), { when: 10, offset: 2 });
  assert.deepEqual(backingSchedule(10, 0, 30), { when: 10, offset: 0 });
  assert.throws(() => backingSchedule(10, -30, 30), /entire recording/);
  assert.throws(() => backingSchedule(10, NaN, 30), /Invalid/);
});
test('backing audio schedules on the shared audio clock and stops with the session', () => {
  const source = Object.assign(new EventTarget(), { connect: () => gain, start: (...args) => { source.started = args; }, stop: () => { source.stopped = true; } });
  const gain = { gain: { value: 0 }, connect: () => null };
  const audio = new DrumAudio();
  audio.context = { createBufferSource: () => source, createGain: () => gain };
  audio.output = {};
  const buffer = {};
  audio.playBacking(buffer, 12, 2, 0.7);
  assert.equal(source.buffer, buffer);
  assert.deepEqual(source.started, [12, 2]);
  assert.equal(gain.gain.value, 0.7);
  audio.silence();
  assert.equal(source.stopped, true);
  assert.equal(audio.sources.size, 0);
});
test('original sample recording is a valid PCM WAV aligned to the MIDI duration', () => {
  const wav = createDemoWav();
  const view = new DataView(wav);
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
  assert.equal(view.getUint32(24, true), 22050);
  near(view.getUint32(40, true) / (22050 * 2), 8.8);
});
test('looped backing sources use bounded recording slices and all cancel on stop', () => {
  const starts = [], sources = [];
  const audio = new DrumAudio();
  audio.context = {
    createBufferSource: () => {
      const source = Object.assign(new EventTarget(), { connect: target => target, start: (...args) => starts.push(args), stop: () => { source.stopped = true; } });
      sources.push(source); return source;
    },
    createGain: () => ({ gain: { value: 0 }, connect: () => null }),
  };
  audio.playBacking({}, 10, 2, 0.65, 4.4);
  audio.playBacking({}, 14.4, 2, 0.65, 4.4);
  assert.deepEqual(starts, [[10, 2, 4.4], [14.4, 2, 4.4]]);
  audio.silence(); assert.ok(sources.every(source => source.stopped)); assert.equal(audio.sources.size, 0);
});
