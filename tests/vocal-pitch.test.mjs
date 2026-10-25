import test from 'node:test';
import assert from 'node:assert/strict';
import { detectVocalPitch, vocalPitchFeedback } from '../dist/vocal-pitch.mjs';

const wave = (frequency, rate, amplitude = .15) => Float32Array.from({ length: 4096 }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / rate) + amplitude * 1.4 * Math.sin(4 * Math.PI * frequency * i / rate));
test('vocal detector finds the fundamental through stronger harmonics at phone sample rates', () => {
  for (const rate of [44100, 48000]) for (const frequency of [65.41, 110, 220, 440, 880, 1174.66]) {
    const result = detectVocalPitch(wave(frequency, rate), rate);
    assert.ok(result, `${frequency} Hz at ${rate}`);
    assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) < 15);
    assert.ok(result.confidence > .85);
  }
});
test('silence, DC offset, quiet input and nonperiodic noise do not become singing notes', () => {
  let seed = 7; const noise = Float32Array.from({ length: 4096 }, () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - .5) * .4; });
  for (const input of [new Float32Array(4096), new Float32Array(4096).fill(.2), wave(220, 48000, .001), noise, new Float32Array(50)]) assert.equal(detectVocalPitch(input, 48000), null);
});
test('lower-latency 2048-sample phone frames retain fundamental accuracy across the singing range', () => {
  for (const rate of [16000, 32000, 44100, 48000, 96000]) for (const frequency of [65.41, 110, 220, 440, 880, 1174.66]) {
    const length = 2 ** Math.ceil(Math.log2(rate * .04));
    const result = detectVocalPitch(wave(frequency, rate).slice(0, length), rate);
    assert.ok(result, `${frequency} Hz at ${rate}`);
    assert.ok(Math.abs(1200 * Math.log2(result.frequency / frequency)) < 15);
  }
});
test('pitch feedback distinguishes sharp/flat, octave choice, rests and uncertain input', () => {
  const notes = [{ pitch: 69, time: 1, duration: 2 }], detection = midi => ({ midi, confidence: .98 });
  const result = midi => vocalPitchFeedback(detection(midi), notes, 2);
  assert.equal(result(69.2).state, 'on-pitch'); assert.equal(result(68.5).state, 'low'); assert.equal(result(69.5).state, 'high');
  assert.equal(result(57).state, 'on-pitch'); assert.equal(result(57).target, 'A3');
  assert.equal(vocalPitchFeedback(detection(57), notes, 2, { anyOctave: false }).state, 'low');
  assert.equal(vocalPitchFeedback(null, notes, 2).cents, null);
  assert.equal(vocalPitchFeedback(detection(69), notes, 3).state, 'rest');
  assert.equal(vocalPitchFeedback(detection(69), notes, 1.01).state, 'changing');
  assert.equal(vocalPitchFeedback({ ...detection(69), clipped: true }, notes, 2).state, 'unclear');
  assert.equal(vocalPitchFeedback(detection(69), [...notes, { pitch: 72, time: 1, duration: 2 }], 2).cents, null);
  assert.equal(vocalPitchFeedback(null, [], 2).state, 'no-melody');
});
