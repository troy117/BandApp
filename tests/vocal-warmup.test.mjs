import test from 'node:test';
import assert from 'node:assert/strict';
import { warmupNotes, comfortableOctave, VocalWarmup, warmupMeterFrame, WARMUP_STEP_SECONDS } from '../dist/vocal-warmup.mjs';

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
  const fields = {}, q = id => fields[id] || (fields[id] = { textContent: '', value: '', hidden: false, dataset: {}, style: {}, attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, removeAttribute(name) { delete this.attrs[name]; } });
  const piano = { calls: [], releases: [], on: (...args) => piano.calls.push(args), off: (...args) => piano.releases.push(args) };
  const practice = { q, rooms: {}, piano, part: { instrument: 'vocals', chart: { notes: [{ pitch: 60 }] } }, audio: { context: { currentTime: 0, state: 'running' }, ready: async () => {} }, stop() { warmup.stop(); } };
  const microphone = { state: 'listening', start: async () => {}, stop() { this.state = 'off'; } };
  const warmup = Object.assign(Object.create(VocalWarmup.prototype), { q, practice, singing: { microphone }, generation: 0, choices: () => ({ exercise: 'song', shift: 0 }) });
  return { warmup, practice, q, piano, microphone };
}
test('warm-up ignores reference tones, requires a held sung note, completes and releases its voice', async () => {
  const { warmup, practice, q, piano } = warmupFixture(); await warmup.start(); warmup.draw({ midi: 60, confidence: .99 });
  assert.equal(q('b-warmup-phase').textContent, 'LISTEN · 4s · 1 / 1'); assert.equal(warmup.matches.size, 0); assert.equal(piano.calls.length, 1);
  assert.equal(piano.releases.at(-1)[1], 4); assert.deepEqual(piano.calls[0][4], { sustain: true });
  practice.audio.context.currentTime = 3.9; warmup.draw({ midi: 60, confidence: .99 });
  practice.audio.context.currentTime = 4.2; warmup.draw({ midi: 60, confidence: .99 });
  assert.equal(warmup.measuredSteps.size, 0); assert.equal(q('b-warmup-dot').hidden, true);
  for (let at = 4.4; at < 5.5; at += .08) { practice.audio.context.currentTime = at; warmup.draw({ midi: 60, confidence: .99 }); }
  assert.equal(warmup.matches.size, 1);
  assert.equal(q('b-warmup-track').attrs['aria-valuenow'], '0'); assert.equal(q('b-warmup-dot').style.left, '50%');
  practice.audio.context.currentTime = 5.7; warmup.draw({ midi: 60.7, confidence: .99 });
  assert.match(q('b-warmup-feedback').textContent, /lower/); assert.equal(q('b-warmup-meter').dataset.state, 'high');
  assert.equal(warmup.matches.size, 1);
  practice.audio.context.currentTime = WARMUP_STEP_SECONDS + .1; warmup.draw(null); assert.equal(warmup.running, false); assert.equal(q('b-warmup-phase').textContent, 'WARM-UP COMPLETE');
  assert.equal(q('b-warmup-dot').hidden, true);
});
test('stopping while microphone permission is pending cannot start a late exercise', async () => {
  const { warmup, microphone } = warmupFixture(); let grant;
  microphone.state = 'requesting'; microphone.start = () => new Promise(resolve => { grant = resolve; });
  const pending = warmup.start(); warmup.stop(); grant(); await pending;
  assert.equal(warmup.running, false); assert.equal(warmup.finding, false); assert.equal(microphone.state, 'off');
});

test('by-ear warm-up completion does not report unmeasured singing as failed notes', async () => {
  const { warmup, practice, microphone, q } = warmupFixture(); microphone.state = 'denied';
  await warmup.start(); warmup.draw(null); practice.audio.context.currentTime = 5; warmup.draw(null);
  practice.audio.context.currentTime = WARMUP_STEP_SECONDS + .1; warmup.draw(null);
  assert.match(q('b-warmup-feedback').textContent, /by ear/); assert.doesNotMatch(q('b-warmup-feedback').textContent, /0 of/);
});

test('warm-up meter gives bounded low/center/high feedback and clears uncertain input', () => {
  assert.equal(warmupMeterFrame({ cents: -75, state: 'low' }).position, 27);
  assert.equal(warmupMeterFrame({ cents: 0, state: 'on-pitch' }).position, 50);
  assert.equal(warmupMeterFrame({ cents: 75, state: 'high' }).position, 73);
  assert.equal(warmupMeterFrame({ cents: 2000 }).position, 96);
  assert.equal(warmupMeterFrame({ cents: null }).position, null);
  const { warmup, q } = warmupFixture();
  warmup.drawMeter({ state: 'low', heard: 'B3', cents: -100, label: 'Sing higher' });
  assert.equal(q('b-warmup-heard').textContent, 'B3'); assert.equal(q('b-warmup-meter').dataset.state, 'low');
  warmup.drawMeter(); assert.equal(q('b-warmup-heard').textContent, '—'); assert.equal(q('b-warmup-dot').hidden, true);
  assert.equal(q('b-warmup-track').attrs['aria-valuenow'], undefined);
});

test('octave finder labels the measured note as You and keeps target matching neutral', async () => {
  const { warmup, practice, q } = warmupFixture(); await warmup.start(true);
  for (let at = .1; at < 2 && warmup.finding; at += .07) {
    practice.audio.context.currentTime = at; warmup.draw({ midi: 60, confidence: .99 });
    assert.equal(q('b-warmup-dot').hidden, true); assert.equal(q('b-warmup-target').textContent, '—');
  }
  assert.equal(q('b-warmup-phase').textContent, 'TRY THIS OCTAVE'); assert.equal(q('b-warmup-heard').textContent, 'C4');
  assert.equal(warmup.suggestion.shift, 0);
});
