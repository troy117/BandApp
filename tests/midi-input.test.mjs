import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MIDI_MAPPING, validateMidiMapping, learnMidiNote, midiNote, MidiDrumInput } from '../dist/midi-input.mjs';
import { Judge, createChart, mappedDrum } from '../dist/engine.mjs';

class InputPort extends EventTarget {
  constructor(id, name = id) { super(); Object.assign(this, { id, name, state: 'connected', opens: 0, closes: 0 }); }
  async open() { this.opens++; if (this.openError) throw this.openError; if (this.openWait) await this.openWait; return this; }
  async close() { this.closes++; return this; }
  hit(bytes = [0x99, 38, 100], timeStamp = 123.456) { const event = Object.assign(new Event('midimessage'), { data: Uint8Array.from(bytes) }); Object.defineProperty(event, 'timeStamp', { value: timeStamp }); this.dispatchEvent(event); }
}
function fixture(ports = [new InputPort('kit', 'TD-17')], options = {}) {
  const access = Object.assign(new EventTarget(), { inputs: new Map(ports.map(port => [port.id, port])) });
  const notes = [], states = [], calls = []; let lost = 0;
  const source = new MidiDrumInput({ secure: true, navigator: { requestMIDIAccess: async options => { calls.push(options); return access; } }, onNote: note => notes.push(note), onState: state => states.push(state), onLost: () => { lost++; }, ...options });
  return { source, access, ports, notes, states, calls, get lost() { return lost; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('MIDI strikes retain native timestamps, channels and velocity, ignoring releases and controllers', () => {
  assert.deepEqual(midiNote({ data: [0x99, 38, 64], timeStamp: 42.123 }), { pitch: 38, velocity: 64 / 127, timestamp: 42.123, channel: 10 });
  assert.equal(midiNote({ data: [0x90, 36, 1], timeStamp: 0 }).timestamp, 0);
  assert.equal(midiNote({ data: [0x9f, 36, 127] }, () => 99).timestamp, 99);
  for (const data of [[0x99, 38, 0], [0x89, 38, 127], [0xb9, 4, 127], [0xa9, 49, 127], [0xf8], [0x99, 128, 127], [0x99, 38], [0x99, 38, 128]]) assert.equal(midiNote({ data }), null);
});
test('pad learning adds rim/edge notes and moves collisions to one drum; ignored notes and valid saved changes survive', () => {
  const mapping = learnMidiNote(DEFAULT_MIDI_MAPPING, 38, 'tom1');
  assert.equal(mapping[38], 'tom1'); assert.equal(mapping[48], 'tom1'); assert.equal(DEFAULT_MIDI_MAPPING[38], 'snare');
  const saved = validateMidiMapping({ ...mapping, 42: 'ignore', 128: 'kick', '-1': 'snare', '003': 'kick', 1: 'invalid' });
  assert.equal(saved[42], 'ignore'); assert.equal(saved[38], 'tom1'); assert.equal(saved[128], undefined); assert.equal(saved[1], undefined); assert.equal(saved['003'], undefined);
  assert.deepEqual(validateMidiMapping(null), DEFAULT_MIDI_MAPPING); assert.throws(() => learnMidiNote(mapping, 128, 'kick'));
});
test('connection is opt-in, requests no sysex, picks TD-17 and listens to that input only', async () => {
  const env = fixture([new InputPort('piano'), new InputPort('kit', 'TD-17')]);
  assert.equal(env.calls.length, 0); await env.source.connect();
  assert.deepEqual(env.calls, [{ sysex: false }]); assert.equal(env.source.status, 'ready'); assert.equal(env.ports[0].opens, 0);
  env.ports[0].hit(); env.ports[1].hit(); assert.equal(env.notes.length, 1);
  await env.source.connect(); env.ports[1].hit(); assert.equal(env.notes.length, 2); assert.equal(env.calls.length, 1);
  env.source.disconnect(); env.ports[1].hit(); assert.equal(env.notes.length, 2); assert.equal(env.ports[1].closes, 1);
});
test('selected port changes release the old input and deliver each simultaneous strike once', async () => {
  const env = fixture([new InputPort('kit', 'TD-17'), new InputPort('other')]); await env.source.connect();
  await env.source.select('other'); env.ports[0].hit(); env.ports[1].hit([0x99, 36, 100], 500); env.ports[1].hit([0x99, 42, 120], 500);
  assert.deepEqual(env.notes.map(note => [note.pitch, note.timestamp]), [[36, 500], [42, 500]]); assert.equal(env.ports[0].closes, 1);
});
test('unplug stops the run hook, preserves the choice, and reconnect never substitutes another input', async () => {
  const env = fixture([new InputPort('kit', 'TD-17'), new InputPort('other')]); await env.source.connect();
  env.ports[0].state = 'disconnected'; env.access.dispatchEvent(new Event('statechange')); await settle();
  assert.equal(env.lost, 1); assert.equal(env.source.status, 'disconnected'); assert.equal(env.ports[1].opens, 0);
  env.ports[0].hit(); assert.equal(env.notes.length, 0);
  const replacement = new InputPort('new-id', 'TD-17'); env.access.inputs.set(replacement.id, replacement); env.access.dispatchEvent(new Event('statechange')); await settle();
  assert.equal(env.source.status, 'ready'); assert.equal(env.source.preferred.id, 'new-id'); replacement.hit(); assert.equal(env.notes.length, 1);
  env.access.dispatchEvent(new Event('statechange')); replacement.hit(); assert.equal(env.notes.length, 2);
});
test('no devices, late USB arrival, remembered device and permission errors provide recoverable states', async () => {
  const env = fixture([]); await env.source.connect(); assert.equal(env.source.status, 'empty');
  env.access.inputs.set('kit', new InputPort('kit', 'TD-17')); env.access.dispatchEvent(new Event('statechange')); await settle();
  assert.equal(env.source.status, 'empty'); await env.source.connect(); assert.equal(env.source.status, 'ready');
  const remembered = fixture([new InputPort('other')], { preferred: { id: 'kit', name: 'TD-17' } }); await remembered.source.connect();
  assert.equal(remembered.source.status, 'disconnected'); assert.equal(remembered.ports[0].opens, 0);
  const denied = fixture([], { navigator: { requestMIDIAccess: async () => { throw Object.assign(new Error(), { name: 'NotAllowedError' }); } } });
  await denied.source.connect(); assert.equal(denied.source.status, 'error'); assert.match(denied.source.message, /site settings/);
  const unsupported = fixture([], { navigator: {} }); await unsupported.source.connect(); assert.equal(unsupported.source.status, 'unsupported');
  const insecure = fixture([], { secure: false }); await insecure.source.connect(); assert.match(insecure.source.message, /HTTPS/); assert.equal(insecure.calls.length, 0);
});
test('busy inputs can retry and abandoned permission/open requests cannot reconnect after disconnect', async () => {
  const env = fixture(); env.ports[0].openError = new Error('Busy'); await env.source.connect(); assert.equal(env.source.status, 'error');
  env.ports[0].openError = null; await env.source.connect(); assert.equal(env.source.status, 'ready');
  let grant; const pending = fixture([], { navigator: { requestMIDIAccess: () => new Promise(resolve => { grant = resolve; }) } });
  const connecting = pending.source.connect(); assert.equal(pending.source.connect(), connecting); pending.source.disconnect(); grant(env.access); await connecting;
  assert.equal(pending.source.status, 'idle'); assert.equal(pending.source.access, null);
  let opened; const delayed = fixture(); delayed.ports[0].openWait = new Promise(resolve => { opened = resolve; });
  const waiting = delayed.source.connect(); await settle(); delayed.source.disconnect(); opened(); await waiting;
  delayed.ports[0].hit(); assert.equal(delayed.source.status, 'idle'); assert.equal(delayed.notes.length, 0);
});
test('MIDI input reaches the existing early/late judge without rounding or losing simultaneous notes', async () => {
  const chart = createChart('rock', 80, 4); const judge = new Judge(chart, 140);
  const env = fixture([], { onNote: note => judge.strike(mappedDrum(note.pitch,DEFAULT_MIDI_MAPPING[note.pitch]), note.timestamp / 1000 - 1, 'midi') });
  const kit = new InputPort('kit', 'TD-17'); env.access.inputs.set(kit.id, kit); await env.source.connect();
  const first = chart.notes.filter(note => note.time === chart.notes[0].time);
  for (const note of first) { const pitch = Object.keys(DEFAULT_MIDI_MAPPING).find(pitch => mappedDrum(pitch,DEFAULT_MIDI_MAPPING[pitch]) === note.drum); kit.hit([0x99, Number(pitch), 110], (1 + note.time + .0234) * 1000); }
  assert.equal(judge.summary().hits, first.length); for (const note of judge.chart.notes.slice(0, first.length)) assert.ok(Math.abs(note.errorMs - 23.4) < 1e-8);
});
