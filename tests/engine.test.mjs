import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, Judge, performanceCsv, DEFAULT_BINDINGS, assignBinding, validateBindings } from '../dist/engine.mjs';
import { KeyboardSource, makeControlId, isTypingTarget } from '../dist/vendor/sightkick-input.mjs';

test('rock exercise keeps simultaneous voices and correct timing at different tempos', () => {
  const chart = createChart('rock', 80, 4);
  assert.equal(chart.notes.length, 48);
  assert.equal(chart.duration, 12);
  assert.deepEqual(chart.notes.filter(note => note.time === 0).map(note => note.drum), ['kick', 'hihat']);
  assert.equal(createChart('backbeat', 120, 1).notes.find(note => note.drum === 'snare').time, 0.5);
});
test('signed errors distinguish early and late; absolute errors do not cancel', () => {
  const judge = new Judge(createChart('backbeat', 120, 1));
  assert.ok(Math.abs(judge.strike('kick', -0.04).errorMs + 40) < 1e-6);
  assert.ok(Math.abs(judge.strike('snare', 0.54).errorMs - 40) < 1e-6);
  assert.ok(Math.abs(judge.summary().meanMs) < 1e-6);
  assert.ok(Math.abs(judge.summary().meanAbsMs - 40) < 1e-6);
});
test('one strike matches one note; a repeat cannot score the same note twice', () => {
  const judge = new Judge(createChart('rock', 120, 1));
  assert.equal(judge.strike('kick', 0).type, 'hit');
  assert.equal(judge.strike('kick', 0).type, 'extra');
  assert.equal(judge.strike('hihat', 0).type, 'hit');
  assert.equal(judge.summary().hits, 2);
});
test('nearby repeats can match the next pending note', () => {
  const judge = new Judge(createChart('rock', 160, 1), 140);
  judge.strike('hihat', 0);
  const next = judge.strike('hihat', 0.10);
  assert.equal(next.type, 'hit');
  assert.equal(next.note.time, 0.1875);
});
test('window boundaries are inclusive and wrong drums never consume expected notes', () => {
  const judge = new Judge(createChart('backbeat', 120, 1), 100);
  assert.equal(judge.strike('crash', 0).type, 'extra');
  assert.equal(judge.strike('kick', 0.1).type, 'hit');
  assert.equal(judge.strike('snare', 0.601).type, 'extra');
  assert.equal(judge.summary().misses, 1);
});
test('finishing counts every unplayed note and extra in the report', () => {
  const judge = new Judge(createChart('backbeat', 120, 1));
  judge.strike('kick', 0);
  judge.strike('ride', 0.1);
  judge.advance(Infinity);
  const score = judge.summary();
  assert.equal(score.hits, 1);
  assert.equal(score.misses, 3);
  assert.equal(score.pending, 0);
  assert.equal(score.extras, 1);
  assert.equal(score.accuracy, 20);
});
test('CSV preserves actual times, negative errors, misses, and extra hits', () => {
  const judge = new Judge(createChart('backbeat', 120, 1));
  judge.strike('kick', -0.025);
  judge.strike('crash', 0.2, 'pad');
  judge.advance(Infinity);
  const csv = performanceCsv(judge);
  assert.match(csv, /-25.00,hit,keyboard/);
  assert.match(csv, /snare,1,2,0.5000,,,miss/);
  assert.match(csv, /crash,,,,0.2000,,extra,pad/);
});
test('remapping prevents duplicate drums, reserves transport keys, and allows alternates', () => {
  const original = structuredClone(DEFAULT_BINDINGS);
  assert.match(assignBinding(original, 'snare', 'Space').reason, /already assigned to Kick/);
  assert.equal(assignBinding(original, 'snare', 'Enter').ok, false);
  const mapped = assignBinding(original, 'snare', 'KeyQ', true);
  assert.deepEqual(mapped.bindings.snare, ['KeyF', 'KeyG', 'KeyQ']);
  assert.deepEqual(original, DEFAULT_BINDINGS);
  assert.deepEqual(assignBinding(original, 'snare', 'KeyQ').bindings.snare, ['KeyQ']);
});
test('stored bindings fall back safely and filter unsupported codes', () => {
  assert.deepEqual(validateBindings({}), DEFAULT_BINDINGS);
  assert.deepEqual(validateBindings({ ...DEFAULT_BINDINGS, snare: ['Enter', 'KeyQ'] }).snare, ['KeyQ']);
});
test('typing and select controls are protected from drum shortcuts', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(isTypingTarget({ tagName }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'BODY' }), false);
});
test('keyboard adapter ignores repeats, modifiers, and typing, forwards native timestamps, and detaches', () => {
  const target = new EventTarget();
  const events = [];
  const detach = new KeyboardSource().start(event => events.push(event), target);
  const press = options => {
    const event = new Event('keydown');
    Object.assign(event, { code: 'KeyF', repeat: false, metaKey: false, ctrlKey: false, altKey: false }, options);
    target.dispatchEvent(event);
  };
  press({ repeat: true }); press({ ctrlKey: true }); press({ altKey: true });
  press({ code: 'KeyF' });
  assert.equal(events.length, 1);
  assert.equal(events[0].controlId, makeControlId('keyboard', 'KeyF'));
  assert.equal(typeof events[0].timestamp, 'number');
  detach(); press({ code: 'KeyD' }); assert.equal(events.length, 1);
});
