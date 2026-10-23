import test from 'node:test';
import assert from 'node:assert/strict';
import { ScreenAwake } from '../dist/screen-awake.mjs';

function awakeFixture() {
  const doc = Object.assign(new EventTarget(), { hidden: false }), states = [], locks = [];
  const nav = { wakeLock: { async request(type) { assert.equal(type, 'screen'); const lock = Object.assign(new EventTarget(), { released: false, async release() { this.released = true; this.dispatchEvent(new Event('release')); } }); locks.push(lock); return lock; } } };
  return { doc, states, locks, nav, awake: new ScreenAwake({ document: doc, navigator: nav, onState: state => states.push(state) }) };
}
test('focus wake lock is held only while visible and reacquired after returning', async () => {
  const { doc, states, locks, awake } = awakeFixture(); await awake.setActive(true); assert.equal(states.at(-1), 'held');
  await awake.setActive(true); assert.equal(locks.length, 1);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); await new Promise(resolve => setImmediate(resolve)); assert.equal(locks[0].released, true);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await new Promise(resolve => setImmediate(resolve)); assert.equal(locks.length, 2); assert.equal(states.at(-1), 'held');
  await awake.setActive(false); assert.equal(locks[1].released, true); assert.equal(states.at(-1), 'off');
});
test('a delayed wake-lock request is released after focus exits', async () => {
  const { awake, nav } = awakeFixture(); let grant, released = false;
  nav.wakeLock.request = () => new Promise(resolve => { grant = resolve; }); const pending = awake.setActive(true); await awake.setActive(false);
  grant({ release: async () => { released = true; } }); await pending; assert.equal(released, true); assert.equal(awake.lock, null);
});
test('unsupported or denied wake lock leaves focus usable with an honest status', async () => {
  const { awake, nav, states } = awakeFixture(); nav.wakeLock.request = async () => { throw new Error('Denied'); };
  await awake.setActive(true); assert.equal(states.at(-1), 'unavailable'); assert.equal(awake.active, true);
  awake.nav = {}; await awake.sync(); assert.equal(states.at(-1), 'unsupported');
});
