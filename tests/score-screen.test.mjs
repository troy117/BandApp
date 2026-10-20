import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreScreen } from '../dist/score-screen.mjs';

function fixture() {
  const classes = () => { const values = new Set(); return { contains: name => values.has(name), toggle: (name, enabled) => enabled ? values.add(name) : values.delete(name) }; };
  const doc = Object.assign(new EventTarget(), { fullscreenElement: null, fullscreenEnabled: true, body: { classList: classes() }, activeElement: null, querySelector: () => null });
  class Element extends EventTarget {
    classList = classes(); attributes = {}; hidden = false; disabled = false;
    setAttribute(name, value) { this.attributes[name] = value; }
    getClientRects() { return [{}]; }
    focus() { doc.activeElement = this; }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  }
  const [root, opener, exit, play, listen, title, toolbar, region] = Array.from({ length: 8 }, () => new Element());
  const controls = [play, listen, exit, region]; root.querySelectorAll = () => controls.filter(control => !control.disabled); root.contains = item => controls.includes(item);
  const calls = { play: 0, listen: 0, exits: 0 };
  doc.exitFullscreen = async () => { calls.exits++; doc.fullscreenElement = null; doc.dispatchEvent(new Event('fullscreenchange')); };
  const screen = new ScoreScreen({ root, opener, exit, play, listen, title, toolbar, document: doc, onPlay: () => { calls.play++; }, onListen: () => { calls.listen++; } });
  return { screen, doc, root, opener, exit, play, listen, title, toolbar, region, calls };
}

test('fullscreen denial keeps a usable maximized score and exiting restores the page without affecting playback', async () => {
  const env = fixture();
  env.root.requestFullscreen = async () => { throw new Error('Embedded browser denial'); };
  await env.screen.enter();
  assert.equal(env.screen.active, true); assert.equal(env.toolbar.hidden, false); assert.equal(env.root.classList.contains('score-expanded'), true);
  assert.equal(env.doc.body.classList.contains('score-maximized'), true); assert.equal(env.doc.activeElement, env.play);
  env.screen.setPlayback({ running: true });
  await env.screen.exit();
  assert.equal(env.screen.active, false); assert.equal(env.toolbar.hidden, true); assert.equal(env.doc.activeElement, env.opener);
  assert.equal(env.doc.body.classList.contains('score-maximized'), false); assert.equal(env.calls.play, 0);
  assert.match(env.play.innerHTML, /Stop/);
});

test('native browser fullscreen exit restores the icon, focus and scrolling', async () => {
  const env = fixture();
  env.root.requestFullscreen = async options => { assert.equal(options.navigationUI, 'hide'); env.doc.fullscreenElement = env.root; env.doc.dispatchEvent(new Event('fullscreenchange')); };
  await env.screen.enter(); assert.equal(env.screen.native, true);
  env.doc.fullscreenElement = null; env.doc.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(env.screen.active, false); assert.equal(env.opener.attributes['aria-pressed'], 'false');
  assert.equal(env.doc.body.classList.contains('score-maximized'), false); assert.equal(env.doc.activeElement, env.opener);
});

test('a late fullscreen request cannot reopen the score after the user has already exited', async () => {
  const env = fixture(); let resolve;
  env.root.requestFullscreen = async () => { await new Promise(done => { resolve = done; }); env.doc.fullscreenElement = env.root; env.doc.dispatchEvent(new Event('fullscreenchange')); };
  const entering = env.screen.enter(); await env.screen.exit(); resolve(); await entering;
  assert.equal(env.screen.active, false); assert.equal(env.doc.fullscreenElement, null);
  assert.equal(env.doc.body.classList.contains('score-maximized'), false); assert.ok(env.calls.exits >= 1);
});

test('maximized keyboard focus stays within the score and Escape leaves the score without becoming a drum shortcut', async () => {
  const env = fixture(); env.doc.fullscreenEnabled = false;
  await env.screen.enter();
  const key = (name, shiftKey = false) => { const event = Object.assign(new Event('keydown', { cancelable: true }), { key: name, shiftKey }); env.doc.dispatchEvent(event); return event; };
  env.region.focus(); assert.equal(key('Tab').defaultPrevented, true); assert.equal(env.doc.activeElement, env.play);
  assert.equal(key('Tab', true).defaultPrevented, true); assert.equal(env.doc.activeElement, env.region);
  assert.equal(key('Escape').defaultPrevented, true); assert.equal(env.screen.active, false); assert.equal(env.calls.play, 0);
});

test('fullscreen transport routes play/listen to the existing transport and reflects starting, playing and finished states', () => {
  const env = fixture();
  env.screen.setTitle('Prepared school song'); assert.equal(env.title.textContent, 'Prepared school song');
  env.play.click(); env.listen.click(); assert.deepEqual([env.calls.play, env.calls.listen], [1, 1]);
  env.screen.setPlayback({ starting: true }); env.play.click(); env.listen.click();
  assert.deepEqual([env.calls.play, env.calls.listen], [1, 1]); assert.match(env.play.innerHTML, /Starting/);
  env.screen.setPlayback({ running: true }); assert.match(env.play.innerHTML, /Stop/); assert.equal(env.listen.disabled, true);
  env.play.click(); assert.equal(env.calls.play, 2);
  env.screen.setPlayback({}); assert.match(env.play.innerHTML, /Play/); assert.equal(env.listen.disabled, false);
});
