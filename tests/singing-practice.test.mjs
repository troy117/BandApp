import test from 'node:test';
import assert from 'node:assert/strict';
import { SingingPractice } from '../dist/singing-practice.mjs';
import { BandPractice } from '../dist/band-practice.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';

test('joining and leaving a jam updates microphone disclosure before capture without hiding permission errors', () => {
  const fields = {}, practice = { rooms: {} }, microphone = { state: 'off', message: 'Your microphone is off.' };
  const singing = Object.assign(Object.create(SingingPractice.prototype), { practice, microphone, q: id => fields[id] ||= { dataset: {}, setAttribute() {} } });
  singing.syncMicContext(); assert.match(fields['b-vocal-mic-status'].textContent, /on this device/);
  practice.rooms.room = { id: 'test-room' }; singing.syncMicContext();
  assert.match(fields['b-vocal-mic-status'].textContent, /shared with your teacher/);
  Object.assign(microphone, { state: 'denied', message: 'Allow microphone in site settings.' }); singing.micState(microphone);
  assert.equal(fields['b-vocal-mic-status'].textContent, microphone.message);
  singing.syncMicContext(); assert.equal(fields['b-vocal-mic-status'].textContent, microphone.message);
  practice.rooms.room = null; Object.assign(microphone, { state: 'off', message: 'Your microphone is off.' }); singing.syncMicContext();
  assert.match(fields['b-vocal-mic-status'].textContent, /on this device/);
});

test('singing pause/continue retains song position, retry uses a lead-in and jam controls remain teacher-led', async () => {
  const chart = { duration: 30, countInBeats: 4, countInBeatSeconds: .5, lyrics: [{ time: 5, end: 8, text: 'Original line' }, { time: 12, end: 14, text: 'Next line' }] };
  const started = [], p = { token: 0, active: true, part: { instrument: 'vocals', chart }, rooms: {}, school: {}, audio: { context: { currentTime: 20 }, audibleTime: () => 20 }, prepareAudio: async () => {}, stop() { this.session = null; singing.stopped(); }, begin(at, options) { this.session = { startAt: at }; started.push({ at, options }); } };
  const singing = Object.assign(Object.create(SingingPractice.prototype), { practice: p, position: 0, busy: false, generation: 1 });
  p.session = { startAt: 13 }; await singing.toggle(); assert.equal(singing.position, 7); assert.equal(singing.paused, true);
  await singing.toggle(); assert.equal(started[0].options.from, 7); assert.equal(started[0].options.skipCountIn, true); assert.ok(Math.abs(started[0].at - 13.15) < .001);
  p.session = { startAt: 13 }; assert.equal(singing.lineStart(), 3); assert.equal(singing.nextLine().time, 12);
  await singing.seek(singing.lineStart(), true); assert.equal(started[1].options.from, 3); assert.equal(started[1].options.skipCountIn, false); assert.ok(Math.abs(started[1].at - 19.15) < .001);
  p.rooms.room = {}; await singing.seek(15, true); assert.equal(started.length, 2);
});
test('vocal seek schedules the correct backing segment and skips old metronome/melody events', t => {
  const previous = globalThis.document; globalThis.document = { hidden: false }; t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const part = builtinArrangement('band-first').parts.find(part => part.instrument === 'vocals'), chart = part.chart;
  for (const offset of [-2, 2, 12]) {
    const played = [], fields = {};
    const p = Object.assign(Object.create(BandPractice.prototype), { part, arrangement: { title: 'Original warmup' }, school: {}, rooms: {}, backing: { offset, volume: .5, buffer: { duration: 40 } }, audio: { playBacking: (...args) => played.push(args) }, q: id => fields[id] || (fields[id] = { scrollIntoView() {} }), playChart: () => chart, lockControls() {} });
    p.begin(100, { from: 8, skipCountIn: true });
    assert.equal(played[0][1], 100 + Math.max(8, offset)); assert.equal(played[0][2], Math.max(0, 8 - offset));
    assert.equal(played[0][4], chart.duration - Math.max(8, offset));
    assert.equal(p.session.count, chart.countInBeats); assert.ok(chart.beats[p.session.beat].time >= 8); assert.ok(chart.notes[p.session.guide].time >= 8);
  }
});

test('vocal view switching preserves playback and lyric-only parts use the text view', () => {
  const buttons = ['highway','lyrics'].map(view => ({ dataset: { vocalView: view }, attrs: {}, setAttribute(key,value) { this.attrs[key] = value; } }));
  const fields = { 'b-lyrics-screen': { dataset: {} }, 'b-vocal-highway': {}, 'b-vocal-views': { querySelectorAll: () => buttons } };
  const session = { startAt: 42 }, practice = { session, part: { instrument: 'vocals', chart: { notes: [{ pitch: 60 }] } } };
  const singing = Object.assign(Object.create(SingingPractice.prototype), { practice, q: id => fields[id] });
  singing.setView('highway'); assert.equal(fields['b-vocal-highway'].hidden, false); assert.equal(buttons[0].attrs['aria-pressed'], 'true');
  singing.setView('lyrics'); assert.equal(fields['b-vocal-highway'].hidden, true); assert.equal(practice.session, session);
  practice.part.chart.notes = []; singing.setView('highway');
  assert.equal(singing.view, 'lyrics'); assert.equal(buttons[0].disabled, true); assert.equal(buttons[1].attrs['aria-pressed'], 'true');
});
