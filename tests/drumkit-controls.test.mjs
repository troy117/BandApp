import test from 'node:test';
import assert from 'node:assert/strict';
import { DrumkitControls } from '../dist/drumkit-controls.mjs';

function fixture(storage) {
  class Element extends EventTarget {
    children = []; dataset = {}; attributes = {}; open = false; disabled = false; hidden = false;
    classList = { toggle() {} };
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(key, value) { this.attributes[key] = value; }
    closest() { return this; }
  }
  const elements = new Map();
  const doc = Object.assign(new EventTarget(), { getElementById: id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); }, createElement: () => new Element() });
  const data = new Map(); storage ??= { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const hits = []; let learned = 0;
  const controls = new DrumkitControls({ document: doc, storage, onHit: hit => hits.push(hit), onLearn: () => { learned++; } });
  const kit = Object.assign(new EventTarget(), { id: 'kit', name: 'TD-17', state: 'connected', open: async () => {}, close: async () => {} });
  controls.input.secure = true; controls.input.navigator = { requestMIDIAccess: async () => Object.assign(new EventTarget(), { inputs: new Map([[kit.id, kit]]) }) };
  const clickLearn = drum => {
    const button = doc.getElementById('midi-mapping-list').children.flatMap(row => row.children).find(button => button.dataset.midiLearn === drum);
    assert.equal(button.disabled, false);
    const event = new Event('click'); Object.defineProperty(event, 'target', { value: button }); doc.getElementById('midi-mapping-list').dispatchEvent(event);
  };
  return { controls, doc, data, storage, kit, hits, clickLearn, get learned() { return learned; } };
}
test('pad learning, hit strength and sound preference save independently of keyboard controls', async () => {
  const env = fixture(); await env.controls.input.connect(); env.doc.getElementById('settings-dialog').open = true;
  env.clickLearn('tom1'); assert.equal(env.learned, 1);
  env.controls.receive({ pitch: 38, velocity: .5, timestamp: 250.25 });
  assert.equal(env.controls.mapping[38], 'tom1'); assert.equal(env.controls.learning, null);
  assert.match(env.doc.getElementById('midi-learn-status').textContent, /Moved from Snare/);
  assert.deepEqual(env.hits[0], { pitch: 38, velocity: .5, timestamp: 250.25, drum: 'tom1', sound: false });
  assert.match(env.doc.getElementById('midi-last-hit').textContent, /High tom.*strength 50%/);
  const sound = env.doc.getElementById('midi-sound'); sound.checked = true; sound.dispatchEvent(new Event('change'));
  const restored = fixture(env.storage); assert.equal(restored.controls.mapping[38], 'tom1'); assert.equal(restored.controls.sound, true); assert.equal(restored.controls.input.preferred.name, 'TD-17');
  assert.deepEqual([...env.data.keys()], ['sierra-groove-midi-v1']);
});
test('closing controls, Escape and disconnection cancel pad learning; unmapped notes are visible without playing', async () => {
  const env = fixture(); await env.controls.input.connect(); const dialog = env.doc.getElementById('settings-dialog'); dialog.open = true;
  env.clickLearn('kick'); dialog.dispatchEvent(new Event('close')); assert.equal(env.controls.learning, null);
  env.controls.receive({ pitch: 80, velocity: 1, timestamp: 0 }); assert.equal(env.hits.length, 0); assert.match(env.doc.getElementById('midi-last-hit').textContent, /Unassigned pad/);
  env.clickLearn('snare'); const escape = Object.assign(new Event('keydown', { cancelable: true }), { code: 'Escape' }); env.doc.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true); assert.equal(env.controls.learning, null);
  env.clickLearn('ride'); env.controls.input.disconnect(); assert.equal(env.controls.learning, null);
  assert.equal(env.doc.getElementById('input-status').textContent, 'Connect drumkit');
});
test('blocked storage does not prevent kit input or learning', async () => {
  const env = fixture({ getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } });
  await env.controls.input.connect(); env.clickLearn('kick'); env.controls.receive({ pitch: 80, velocity: 1, timestamp: 5 });
  assert.equal(env.hits[0].drum, 'kick'); assert.match(env.doc.getElementById('midi-storage').textContent, /last for this visit/); assert.match(env.doc.getElementById('midi-learn-status').textContent, /Kept for this visit/);
});

test('saved generic hi-hat pads migrate, distinct MIDI hits reach practice, and explicit relearning survives reload',async()=>{
  const data=new Map([['sierra-groove-midi-v1',JSON.stringify({mapping:{22:'hihat',26:'hihat',42:'hihat',44:'hihat',46:'hihat',60:'snare',61:'ignore'},sound:false})]]);
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const env=fixture(storage);await env.controls.input.connect();
  const send=bytes=>env.kit.dispatchEvent(Object.assign(new Event('midimessage'),{data:Uint8Array.from(bytes)}));
  for(const pitch of [42,46,44,22,26])send([0x99,pitch,100]);
  assert.deepEqual(env.hits.map(hit=>hit.drum),['hihat','hihat-open','hihat-pedal','hihat','hihat-open']);
  for(const bytes of [[0xb9,4,127],[0xb9,4,0],[0x99,46,0],[0x89,46,100]])send(bytes);
  assert.equal(env.hits.length,5);assert.equal(env.controls.mapping[60],'snare');assert.equal(env.controls.mapping[61],'ignore');
  const labels=env.doc.getElementById('midi-mapping-list').children.map(row=>row.children[0].textContent);
  for(const label of ['Closed hi-hat','Open hi-hat','Pedal hi-hat'])assert.ok(labels.includes(label));
  env.clickLearn('hihat');send([0x99,46,100]);assert.equal(env.hits.at(-1).drum,'hihat');
  const restored=fixture(storage);restored.controls.receive({pitch:46,velocity:.5,timestamp:10});assert.equal(restored.hits[0].drum,'hihat');
});
