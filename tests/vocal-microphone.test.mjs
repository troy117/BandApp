import test from 'node:test';
import assert from 'node:assert/strict';
import { VocalMicrophone } from '../dist/vocal-microphone.mjs';

function microphoneEnvironment(request) {
  const tracks = [], contexts = [], connections = [], states = []; let now = 0;
  const makeStream = () => {
    const track = { stopped: false, listeners: {}, stop() { this.stopped = true; }, addEventListener(name, listener) { this.listeners[name] = listener; } }; tracks.push(track);
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  };
  const analyser = { disconnect() {}, getFloatTimeDomainData(buffer) { for (let i = 0; i < buffer.length; i++) buffer[i] = .2 * Math.sin(2 * Math.PI * 220 * i / 48000); } };
  class Context {
    constructor() { this.state = 'suspended'; this.sampleRate = 48000; this.listeners = {}; contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    createMediaStreamSource() { return { connect: node => connections.push(node), disconnect() {} }; }
    createAnalyser() { return analyser; }
  }
  const environment = { isSecureContext: true, AudioContext: Context, performance: { now: () => now }, navigator: { mediaDevices: { getUserMedia: args => request ? request(args, makeStream) : Promise.resolve(makeStream()) } } };
  const microphone = new VocalMicrophone({ environment, onState: state => states.push(state) });
  return { microphone, environment, tracks, contexts, connections, analyser, states, advance: (ms = 70) => { now += ms; } };
}
test('microphone is opt-in, analyzes locally without speaker monitoring, and releases audio resources', async () => {
  const env = microphoneEnvironment(); assert.equal(env.contexts.length, 0);
  await env.microphone.start(); assert.equal(env.microphone.state, 'listening'); assert.deepEqual(env.connections, [env.analyser]);
  assert.equal(env.microphone.sample(), null); env.advance(); assert.ok(Math.abs(env.microphone.sample().midi - 57) < .1);
  env.microphone.stop(); assert.equal(env.tracks[0].stopped, true); assert.equal(env.contexts[0].state, 'closed'); assert.equal(env.microphone.sample(), null);
});
test('short frames confirm a new note within 32 ms and preserve capture time for cached and quiet samples', async () => {
  const env = microphoneEnvironment(); await env.microphone.start();
  assert.equal(env.analyser.fftSize, 2048);
  env.microphone.sample(); env.advance(32);
  const first = env.microphone.sample(); assert.ok(first);
  assert.ok(Math.abs(first.age - (.08 + 2048 / 96000)) < 1e-8);
  env.advance(10); const cached = env.microphone.sample();
  assert.ok(Math.abs(cached.age - first.age - .01) < 1e-8);
  env.analyser.getFloatTimeDomainData = buffer => buffer.fill(0);
  env.advance(22); assert.equal(env.microphone.sample(), null);
  assert.ok(Math.abs(env.microphone.sampleAge() - first.age) < 1e-8);
  env.advance(10); assert.ok(Math.abs(env.microphone.sampleAge() - first.age - .01) < 1e-8);
  env.microphone.stop(); assert.equal(env.microphone.sampleAge(), 0);
});
test('browser-reported input latency replaces the fallback estimate', async () => {
  let constraints;
  const env = microphoneEnvironment((args, make) => { constraints = args; const stream = make(); stream.getAudioTracks()[0].getSettings = () => ({ latency: .15 }); return Promise.resolve(stream); });
  await env.microphone.start(); assert.equal(constraints.audio.latency.ideal, .01);
  assert.equal(env.microphone.latencyReported, true); assert.equal(env.microphone.inputLatency, .15);
  env.microphone.sample(); env.advance(32); assert.ok(Math.abs(env.microphone.sample().age - .15 - 2048 / 96000) < 1e-8);
  env.microphone.stop();
});
test('measured calibration replaces estimated input delay without adding it twice and clears when the mic stops', async () => {
  const env = microphoneEnvironment(); await env.microphone.start();
  env.microphone.setCalibration(.23); env.microphone.sample(); env.advance(32);
  assert.ok(Math.abs(env.microphone.sample().age - .23 - 2048 / 96000) < 1e-8);
  env.microphone.setCalibration(null); env.microphone.sample(); env.advance(32);
  assert.ok(Math.abs(env.microphone.sample().age - .08 - 2048 / 96000) < 1e-8);
  env.microphone.setCalibration(.2); env.microphone.stop(); assert.equal(env.microphone.calibratedLatency, null);
});
test('cancelling a pending permission request stops a late stream without reviving the mic', async () => {
  let resolveRequest, makeStream;
  const env = microphoneEnvironment((_args, make) => { makeStream = make; return new Promise(resolve => { resolveRequest = resolve; }); });
  const pending = env.microphone.start(); assert.equal(env.microphone.state, 'requesting');
  env.microphone.stop(); resolveRequest(makeStream()); await pending;
  assert.equal(env.microphone.state, 'off'); assert.equal(env.tracks[0].stopped, true); assert.equal(env.contexts[0].state, 'closed'); assert.equal(env.connections.length, 0);
});
test('denial is recoverable and phone interruptions/unplugging turn the mic off', async () => {
  let denied = true;
  const env = microphoneEnvironment((_args, make) => denied ? Promise.reject(Object.assign(new Error(), { name: 'NotAllowedError' })) : Promise.resolve(make()));
  await env.microphone.start(); assert.equal(env.microphone.state, 'denied'); assert.equal(env.contexts[0].state, 'closed');
  denied = false; await env.microphone.start(); assert.equal(env.microphone.state, 'listening');
  env.contexts[1].state = 'suspended'; env.contexts[1].listeners.statechange(); assert.equal(env.microphone.state, 'interrupted'); assert.equal(env.tracks[0].stopped, true);
  await env.microphone.start(); env.tracks[1].listeners.ended(); assert.equal(env.microphone.state, 'interrupted'); assert.equal(env.contexts[2].state, 'closed');
  env.environment.isSecureContext = false; await env.microphone.start(); assert.equal(env.microphone.state, 'unsupported'); assert.equal(env.contexts.length, 3);
});
