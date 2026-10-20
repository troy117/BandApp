import { DRUMS } from './engine.mjs';

export const DEFAULT_MIDI_MAPPING = Object.fromEntries(DRUMS.flatMap(drum => drum.midi.map(pitch => [pitch, drum.id])));
Object.assign(DEFAULT_MIDI_MAPPING, { 37: 'snare', 52: 'crash' });
export function validateMidiMapping(input) {
  const result = { ...DEFAULT_MIDI_MAPPING };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const [pitch, drum] of Object.entries(input)) {
    if (/^(0|[1-9]\d{0,2})$/.test(pitch) && Number(pitch) <= 127 && (drum === 'ignore' || DRUMS.some(item => item.id === drum))) result[pitch] = drum;
  }
  return result;
}
export function learnMidiNote(mapping, pitch, drum) {
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127 || !DRUMS.some(item => item.id === drum)) throw new Error('Choose a drum and play a valid MIDI note.');
  return { ...validateMidiMapping(mapping), [pitch]: drum };
}
export function midiNote(event, now = () => performance.now()) {
  const bytes = event.data;
  if (!bytes || bytes.length !== 3 || !Number.isInteger(bytes[0]) || bytes[0] < 0x90 || bytes[0] > 0x9f || !Number.isInteger(bytes[1]) || bytes[1] < 0 || bytes[1] > 127 || !Number.isInteger(bytes[2]) || bytes[2] < 1 || bytes[2] > 127) return null;
  return { pitch: bytes[1], velocity: bytes[2] / 127, channel: (bytes[0] & 15) + 1, timestamp: Number.isFinite(event.timeStamp) && event.timeStamp >= 0 ? event.timeStamp : now() };
}
export function midiError(error) {
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return 'Drumkit access was blocked. Allow MIDI devices in Chrome’s site settings, then try Connect drumkit again. A school-managed browser may need your administrator to allow it.';
  return 'Could not open the drumkit. Close other music apps or tabs using it, check its USB connection, then try Connect drumkit again.';
}

// Only the selected input is opened. No MIDI outputs or system-exclusive access.
export class MidiDrumInput {
  constructor({ navigator = globalThis.navigator, secure = globalThis.isSecureContext, onNote = () => {}, onState = () => {}, onLost = () => {}, preferred = {} } = {}) {
    Object.assign(this, { navigator, secure, onNote, onState, onLost });
    this.preferred = { id: preferred.id || '', name: preferred.name || '' };
    this.status = 'idle'; this.message = 'Connect your kit by USB, then allow MIDI access.';
    this.access = null; this.port = null; this.devices = []; this.generation = 0; this.request = null;
    this.stateChange = () => { this.refresh(); };
    this.receive = event => {
      if (this.status !== 'ready' || this.port?.state !== 'connected') return;
      const note = midiNote(event); if (note) this.onNote(note);
    };
  }
  snapshot() { return { status: this.status, message: this.message, devices: this.devices, selectedId: this.port?.id || this.preferred.id, name: this.port?.name || this.preferred.name }; }
  publish(status = this.status, message = this.message) { this.status = status; this.message = message; this.onState(this.snapshot()); }
  connect() {
    if (this.request) return this.request;
    if (this.access) return this.refresh(true);
    if (!this.secure || typeof this.navigator?.requestMIDIAccess !== 'function') {
      this.publish('unsupported', !this.secure ? 'Open Groove Lab at its HTTPS address or localhost to connect a drumkit.' : 'This browser cannot connect a drumkit. Open Groove Lab in Chrome on Windows or a Chromebook. Keyboard controls still work.');
      return Promise.resolve();
    }
    const generation = ++this.generation;
    this.publish('connecting', 'Allow access to MIDI devices if Chrome asks.');
    const request = (async () => {
      try {
        const access = this.access || await this.navigator.requestMIDIAccess({ sysex: false });
        if (generation !== this.generation) return;
        if (!this.access) { this.access = access; access.addEventListener('statechange', this.stateChange); }
        await this.refresh(true);
      } catch (error) { if (generation === this.generation) this.publish('error', midiError(error)); }
    })();
    this.request = request;
    request.finally(() => { if (this.request === request) this.request = null; });
    return request;
  }
  refresh(initial = false) {
    if (!this.access) return Promise.resolve();
    const ports = [...this.access.inputs.values()].filter(port => port.state === 'connected');
    this.devices = ports.map(port => ({ id: port.id, name: port.name || 'USB MIDI drumkit', manufacturer: port.manufacturer || '' }));
    if (this.port && ports.includes(this.port)) { this.publish(); return Promise.resolve(); }
    if (this.port) {
      this.release(); ++this.generation;
      this.publish('disconnected', 'Drumkit disconnected. Reconnect its USB cable; keyboard controls still work.');
      this.onLost();
    }
    // Reconnect the chosen device, never silently substitute a different kit.
    const choice = ports.find(port => port.id === this.preferred.id) || (this.preferred.name && ports.find(port => port.name === this.preferred.name)) || (initial && !this.preferred.id && !this.preferred.name && (ports.find(port => /TD[- ]?17/i.test(port.name || '')) || ports[0]));
    if (choice) return this.select(choice.id);
    this.publish(this.preferred.id || this.preferred.name ? 'disconnected' : 'empty', ports.length ? 'Choose your drumkit from the list.' : 'No drumkit found. Turn the TD-17 on, check its USB COMPUTER connection, then reconnect. See USB setup below.');
    return Promise.resolve();
  }
  async select(id) {
    const port = this.access?.inputs.get(id);
    if (!port || port.state !== 'connected') return;
    if (this.port === port && this.status === 'ready') return;
    const generation = ++this.generation;
    this.release(); this.port = port;
    this.preferred = { id: port.id, name: port.name || '' };
    this.publish('opening', 'Opening your drumkit…');
    try {
      await port.open();
      if (generation !== this.generation || this.port !== port) { if (this.port !== port) await port.close().catch(() => {}); return; }
      if (port.state !== 'connected') { this.refresh(); return; }
      port.addEventListener('midimessage', this.receive);
      this.publish('ready', 'Drumkit ready. Strike each pad to check its assignment, then choose Done and start a groove.');
    } catch (error) {
      if (generation !== this.generation) return;
      this.release(); this.publish('error', midiError(error));
    }
  }
  release() {
    if (!this.port) return;
    const port = this.port; this.port = null;
    port.removeEventListener('midimessage', this.receive);
    port.close().catch(() => {});
  }
  disconnect() {
    ++this.generation; this.request = null;
    this.access?.removeEventListener('statechange', this.stateChange);
    this.access = null; this.devices = []; this.release();
    this.publish('idle', 'Drumkit disconnected from this page. Keyboard controls are ready.');
  }
}
