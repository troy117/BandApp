import { DRUMS, mappedDrum } from './engine.mjs';
import { MidiDrumInput, DEFAULT_MIDI_MAPPING, validateMidiMapping, learnMidiNote } from './midi-input.mjs';

export class DrumkitControls {
  constructor({ document = globalThis.document, storage, onHit = () => {}, onLost = () => {}, onLearn = () => {} } = {}) {
    this.document = document; this.storage = storage; this.onHit = onHit; this.onLearn = onLearn;
    this.$ = id => document.getElementById(id);
    let saved = {}; this.saved = true;
    try { this.storage ??= globalThis.localStorage; saved = JSON.parse(this.storage.getItem('sierra-groove-midi-v1') || '{}') || {}; } catch { this.saved = false; }
    this.mapping = validateMidiMapping(saved.mapping); this.sound = saved.sound === true; this.learning = null;
    this.input = new MidiDrumInput({ preferred: { id: typeof saved.id === 'string' ? saved.id : '', name: typeof saved.name === 'string' ? saved.name : '' }, onNote: note => this.receive(note), onState: state => this.renderState(state), onLost });
    this.$('midi-sound').checked = this.sound;
    this.$('connect-midi').addEventListener('click', () => this.input.connect());
    this.$('disconnect-midi').addEventListener('click', () => { this.cancelLearn(); this.input.disconnect(); });
    this.$('midi-device').addEventListener('change', () => { this.cancelLearn(); this.input.select(this.$('midi-device').value); });
    this.$('midi-sound').addEventListener('change', () => { this.sound = this.$('midi-sound').checked; this.persist(); });
    this.$('cancel-midi-learn').addEventListener('click', () => this.cancelLearn());
    this.$('reset-midi').addEventListener('click', () => { this.mapping = { ...DEFAULT_MIDI_MAPPING }; this.cancelLearn(); this.persist(); this.renderMappings(); this.$('midi-learn-status').textContent = 'Default drumkit assignments restored.'; });
    this.$('midi-mapping-list').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.midiLearn) {
        this.onLearn(); this.learning = button.dataset.midiLearn;
        this.$('midi-learn-status').textContent = `Strike ${DRUMS.find(drum => drum.id === this.learning).name} once. Hit its rim or edge in a separate Learn pad step to add that too. Esc cancels.`;
        this.renderMappings();
      } else if (button.dataset.midiRemove) {
        this.mapping[button.dataset.midiRemove] = 'ignore'; this.cancelLearn(); this.persist(); this.renderMappings();
        this.$('midi-learn-status').textContent = `Note ${button.dataset.midiRemove} is ignored. Learn pad can assign it again.`;
      }
    });
    this.$('settings-dialog').addEventListener('close', () => this.cancelLearn());
    document.addEventListener('keydown', event => {
      if (event.code === 'Escape' && this.learning && this.$('settings-dialog').open) { event.preventDefault(); event.stopImmediatePropagation(); this.cancelLearn(); }
    }, true);
    this.renderMappings(); this.renderState(this.input.snapshot()); this.persist();
  }
  persist() {
    try { this.storage.setItem('sierra-groove-midi-v1', JSON.stringify({ mapping: this.mapping, sound: this.sound, ...this.input.preferred })); }
    catch { this.saved = false; }
    this.$('midi-storage').textContent = this.saved ? 'Pad assignments save in this browser on this device.' : 'Storage unavailable. Pad assignments last for this visit.';
  }
  cancelLearn() {
    if (this.learning) this.$('midi-learn-status').textContent = 'Pad learning cancelled.';
    this.learning = null; this.renderMappings();
  }
  renderMappings() {
    const list = this.$('midi-mapping-list'); list.replaceChildren();
    for (const drum of DRUMS) {
      const row = this.document.createElement('div'); row.className = 'midi-mapping-row'; row.classList.toggle('capturing', this.learning === drum.id);
      const name = this.document.createElement('strong'); name.textContent = drum.name;
      const notes = this.document.createElement('span'); notes.className = 'midi-note-list';
      for (const [pitch, owner] of Object.entries(this.mapping)) {
        if (mappedDrum(pitch,owner) !== drum.id) continue;
        const chip = this.document.createElement('button'); chip.className = 'midi-note-chip'; chip.dataset.midiRemove = pitch; chip.textContent = `${pitch} ×`; chip.setAttribute('aria-label', `Ignore MIDI note ${pitch} for ${drum.name}`); notes.append(chip);
      }
      if (!notes.children.length) notes.textContent = 'No pad assigned';
      const learn = this.document.createElement('button'); learn.className = 'button quiet'; learn.dataset.midiLearn = drum.id; learn.textContent = this.learning === drum.id ? 'Strike pad…' : 'Learn pad'; learn.setAttribute('aria-label', `Learn ${drum.name} pad`); learn.disabled = this.input.status !== 'ready';
      row.append(name, notes, learn); list.append(row);
    }
    this.$('cancel-midi-learn').hidden = !this.learning;
  }
  renderState(state) {
    const select = this.$('midi-device'); select.replaceChildren();
    const empty = this.document.createElement('option'); empty.value = ''; empty.textContent = state.devices.length ? 'Choose a drumkit' : 'No drumkit detected'; select.append(empty);
    for (const device of state.devices) {
      const option = this.document.createElement('option'); option.value = device.id; option.textContent = device.name; select.append(option);
    }
    select.value = state.devices.some(device => device.id === state.selectedId) ? state.selectedId : '';
    select.disabled = !state.devices.length || ['connecting', 'opening'].includes(state.status);
    this.$('midi-status').textContent = state.message;
    this.$('connect-midi').disabled = ['connecting', 'opening'].includes(state.status);
    this.$('connect-midi').textContent = state.status === 'ready' ? 'Refresh devices' : 'Connect drumkit';
    this.$('disconnect-midi').hidden = !this.input.access && state.status !== 'connecting';
    this.$('input-status').textContent = state.status === 'ready' ? 'Drumkit connected' : 'Connect drumkit';
    if (state.status !== 'ready') this.cancelLearn(); else { this.persist(); this.renderMappings(); }
  }
  receive(note) {
    let drum = mappedDrum(note.pitch,this.mapping[note.pitch]);
    if (this.learning) {
      const previous = DRUMS.find(item => item.id === drum)?.name;
      drum = this.learning; this.mapping = learnMidiNote(this.mapping, note.pitch, drum); this.learning = null;
      this.persist(); this.renderMappings();
      const name = DRUMS.find(item => item.id === drum).name;
      this.$('midi-learn-status').textContent = `${name} learned note ${note.pitch}.${previous && previous !== name ? ` Moved from ${previous}.` : ''} ${this.saved ? 'Saved on this device.' : 'Kept for this visit.'}`;
    }
    const name = DRUMS.find(item => item.id === drum)?.name;
    this.$('midi-last-hit').textContent = `${name || 'Unassigned pad'} · note ${note.pitch} · strength ${Math.round(note.velocity * 100)}%${name ? '' : ' — choose Learn pad to assign it.'}`;
    if (name) this.onHit({ ...note, drum, sound: this.sound });
  }
}
