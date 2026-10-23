import test from 'node:test';
import assert from 'node:assert/strict';
import { warmupNotes, comfortableOctave, VocalWarmup } from '../dist/vocal-warmup.mjs';

test('song warm-up retains real melody pitches while selected keys use major/minor intervals', () => {
  const notes = [57, 57, 60, 62, 60, 57, 64].map(pitch => ({ pitch }));
  assert.deepEqual(warmupNotes(notes), [57, 60, 62, 60, 57]);
  assert.deepEqual(warmupNotes(notes, { shift: 12 }), [69, 72, 74, 72, 69]);
  assert.deepEqual(warmupNotes([], { exercise: 'scale', root: 5, shift: -12 }), [53,55,57,58,60,58,57,55,53]);
  assert.deepEqual(warmupNotes([], { exercise: 'scale', root: 9, minor: true }).slice(0,5), [69,71,72,74,76]);
  assert.deepEqual(warmupNotes([]), []);
});
test('comfortable-octave suggestion requires sustained, confident input and rejects unstable/clipped notes', () => {
  const observations = Array.from({ length: 25 }, (_, i) => ({ midi: 48 + Math.sin(i) * .1, confidence: .98, at: i * .07 }));
  assert.deepEqual(comfortableOctave(observations, 60), { heard: 48, shift: -12 });
  assert.equal(comfortableOctave(observations.slice(0,8), 60), null);
  assert.equal(comfortableOctave(observations.map((item, i) => ({ ...item, midi: 40 + i })), 60), null);
  assert.equal(comfortableOctave(observations.map(item => ({ ...item, confidence: .4 })), 60), null);
  assert.equal(comfortableOctave(observations.map(item => ({ ...item, clipped: true })), 60), null);
});

function warmupFixture() {
  const fields = {}, q = id => fields[id] || (fields[id] = { textContent: '', value: '', hidden: false });
  const piano = { calls: [], on: (...args) => piano.calls.push(args), off() {} };
  const practice = { q, rooms: {}, piano, part: { instrument: 'vocals', chart: { notes: [{ pitch: 60 }] } }, audio: { context: { currentTime: 0, state: 'running' }, ready: async () => {} }, stop() { warmup.stop(); } };
  const microphone = { state: 'listening', start: async () => {}, stop() { this.state = 'off'; } };
  const warmup = Object.assign(Object.create(VocalWarmup.prototype), { q, practice, singing: { microphone }, generation: 0, choices: () => ({ exercise: 'song', shift: 0 }) });
  return { warmup, practice, q, piano, microphone };
}
test('warm-up ignores reference tones, requires a held sung note, completes and releases its voice', async () => {
  const { warmup, practice, q, piano } = warmupFixture(); await warmup.start(); warmup.draw({ midi: 60, confidence: .99 });
  assert.equal(q('b-warmup-phase').textContent, 'LISTEN · 1 / 1'); assert.equal(warmup.matches.size, 0); assert.equal(piano.calls.length, 1);
  for (let at = 1.4; at < 2.5; at += .08) { practice.audio.context.currentTime = at; warmup.draw({ midi: 60, confidence: .99 }); }
  assert.equal(warmup.matches.size, 1);
  practice.audio.context.currentTime = 5.1; warmup.draw(null); assert.equal(warmup.running, false); assert.equal(q('b-warmup-phase').textContent, 'WARM-UP COMPLETE');
});
test('stopping while microphone permission is pending cannot start a late exercise', async () => {
  const { warmup, microphone } = warmupFixture(); let grant;
  microphone.state = 'requesting'; microphone.start = () => new Promise(resolve => { grant = resolve; });
  const pending = warmup.start(); warmup.stop(); grant(); await pending;
  assert.equal(warmup.running, false); assert.equal(warmup.finding, false); assert.equal(microphone.state, 'off');
});

test('by-ear warm-up completion does not report unmeasured singing as failed notes', async () => {
  const { warmup, practice, microphone, q } = warmupFixture(); microphone.state = 'denied';
  await warmup.start(); warmup.draw(null); practice.audio.context.currentTime = 2; warmup.draw(null);
  practice.audio.context.currentTime = 5.1; warmup.draw(null);
  assert.match(q('b-warmup-feedback').textContent, /by ear/); assert.doesNotMatch(q('b-warmup-feedback').textContent, /0 of/);
});
