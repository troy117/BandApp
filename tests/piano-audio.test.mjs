import test from 'node:test';
import assert from 'node:assert/strict';
import { PianoVoices } from '../dist/piano-audio.mjs';

test('reference voices sustain until scheduled release while keyboard voices retain their decay', () => {
  const events = [], oscillator = { frequency: {}, connect() { return this; }, start() {}, stop(at) { events.push(['stop', at]); } };
  const gain = { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(...args) { events.push(['decay', ...args]); }, cancelScheduledValues() {}, setTargetAtTime(...args) { events.push(['release', ...args]); } }, connect() { return this; } };
  const audio = { context: { state: 'running', currentTime: 10, createOscillator: () => oscillator, createGain: () => gain }, sources: new Set() };
  const voices = new PianoVoices(audio);
  voices.on('reference', 60, .65, 10, { sustain: true }); voices.off('reference', 14);
  assert.equal(events.some(event => event[0] === 'decay'), false); assert.equal(events.find(event => event[0] === 'release')[2], 14);
  voices.on('keyboard', 60); assert.equal(events.some(event => event[0] === 'decay'), true);
});
