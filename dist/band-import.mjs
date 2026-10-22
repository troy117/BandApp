import { parseMidiSong } from './midi.mjs';
import { DEFAULT_MIDI_MAPPING } from './midi-input.mjs';
import { arrangementParts, importedArrangement } from './arrangements.mjs';
import { validateAlignment } from './sync.mjs';
import { escapeHtml } from './song-import.mjs';

export class BandImport {
  constructor(practice) {
    this.practice = practice; this.q = practice.q; this.token = 0; this.draft = null;
    const q = this.q;
    q('b-open-import').onclick = () => { if (practice.rooms.room) { practice.message('Leave the session before preparing a different arrangement.'); return; } practice.stop(); q('b-import-panel').hidden = false; q('b-import-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    q('b-import-close').onclick = () => { q('b-import-panel').hidden = true; };
    q('b-midi-file').onchange = () => this.attempt(() => this.readMidi());
    q('b-audio-file').onchange = () => this.attempt(() => this.readAudio());
    q('b-clear-audio').onclick = () => { this.audioToken = (this.audioToken || 0) + 1; q('b-audio-file').value = ''; if (this.draft) Object.assign(this.draft, { audioBytes: null, buffer: null, audioName: '', pendingAudio: false, audioFailed: false }); q('b-import-state').textContent = 'Backing removed.'; };
    q('b-import-apply').onclick = () => this.attempt(() => this.apply());
    q('b-publish').onclick = () => this.attempt(() => this.publish());
    q('b-setup-save').onclick = () => this.attempt(() => this.downloadSetup());
    q('b-setup-file').onchange = () => this.attempt(() => this.loadSetup());
  }
  async attempt(action) { try { await action(); } catch (error) { this.q('b-import-state').textContent = error.message; } }
  reset() { this.token++; this.draft = null; this.q('b-import-panel').hidden = true; this.q('b-import-tracks').textContent = ''; for (const id of ['b-midi-file', 'b-audio-file', 'b-setup-file', 'b-import-title']) this.q(id).value = ''; this.q('b-import-state').textContent = ''; this.q('b-publish').textContent = 'Publish new school song'; }
  renderDraft(metadata = {}) {
    const q = this.q, song = this.draft.song;
    const assigned = metadata.parts ? new Map(metadata.parts.flatMap(part => part.selected.map(id => [id, part.instrument]))) : null;
    q('b-import-title').value = metadata.title || song.title;
    q('b-import-offset').value = metadata.offset ?? 0; q('b-import-speed').value = 100 / (metadata.timeScale ?? 1); q('b-import-volume').value = (metadata.volume ?? 0.65) * 100;
    q('b-publish').textContent = this.draft.schoolSource ? 'Publish school song update' : 'Publish new school song';
    q('b-import-tracks').innerHTML = song.parts.map(part => {
      const instrument = assigned ? assigned.get(part.id) : part.drumCandidate ? 'drums' : part.keyboardCandidate ? 'keyboard' : '';
      return '<div class="band-track"><div>' + escapeHtml(part.name) + '<small>Track ' + part.track + ' · MIDI channel ' + part.channel + ' · ' + part.notes.length + ' notes' + (part.keyboardCandidate ? ' · Suggested piano / keyboard' : '') + '</small></div><label>Assign to<select data-band-track="' + escapeHtml(part.id) + '"><option value="">Ignore</option><option value="drums"' + (instrument === 'drums' ? ' selected' : '') + '>Drums</option><option value="keyboard"' + (instrument === 'keyboard' ? ' selected' : '') + '>Piano / Keyboard</option></select></label></div>';
    }).join('');
  }
  async editSchoolSong(id) {
    if (this.practice.rooms.room) throw new Error('Leave the session before editing song parts.');
    if (!this.practice.school.staff) throw new Error('Sign in as a teacher to edit song parts.');
    this.practice.stop(); this.reset(); const token = this.token, school = this.practice.school;
    this.q('b-import-panel').hidden = false; this.q('b-import-state').textContent = 'Loading the existing MIDI, backing and part settings…';
    this.q('b-import-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const { song: meta } = await school.request('/library/' + id);
    if (token !== this.token) return;
    if (!meta.canManage) throw new Error('Only the publishing teacher or school owner can update this song.');
    const bytes = await school.download('/library/' + id + '/revisions/' + meta.revisionId + '/midi');
    if (token !== this.token) return;
    const audioBytes = meta.audioName ? await school.download('/library/' + id + '/revisions/' + meta.revisionId + '/audio') : null;
    if (token !== this.token) return;
    const buffer = audioBytes ? await this.practice.audio.decodeBacking(audioBytes.slice(0)) : null;
    if (token !== this.token) return;
    this.draft = { song: parseMidiSong(bytes, meta.fileName), bytes, fileName: meta.fileName, audioBytes, buffer, audioName: meta.audioName, mapping: meta.mapping, schoolSource: { songId: id, revisionId: meta.revisionId } };
    this.renderDraft(meta);
    this.q('b-import-state').textContent = 'Existing backing and alignment retained' + (meta.audioName ? ' · ' + meta.audioName : '') + '. Check the Piano / Keyboard and Drums tracks, then publish the update.';
  }
  async readMidi() {
    const file = this.q('b-midi-file').files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a MIDI smaller than 10 MB.');
    const token = ++this.token; this.draft = null; this.q('b-import-tracks').textContent = ''; this.q('b-audio-file').value = '';
    const bytes = await file.arrayBuffer(); if (token !== this.token) return;
    const song = parseMidiSong(bytes, file.name); this.draft = { song, bytes, fileName: file.name, audioBytes: null, buffer: null, audioName: '' };
    this.renderDraft();
    this.q('b-import-state').textContent = 'Piano and drum tracks are suggested when the MIDI identifies them. Check each assignment; other tracks stay ignored. Keyboard parts keep their original pitches.';
  }
  async readAudio() {
    if (!this.draft) throw new Error('Choose MIDI first.');
    const file = this.q('b-audio-file').files[0]; if (!file) { this.draft.audioBytes = null; this.draft.buffer = null; this.draft.audioName = ''; return; }
    if (file.size > 100 * 1024 * 1024) throw new Error('Choose audio smaller than 100 MB.');
    const token = this.token, draft = this.draft, audioToken = this.audioToken = (this.audioToken || 0) + 1;
    Object.assign(draft, { pendingAudio: true, audioFailed: false, audioBytes: null, buffer: null, audioName: '' });
    this.q('b-import-state').textContent = 'Decoding backing recording…';
    try {
    const bytes = await file.arrayBuffer(), buffer = await this.practice.audio.decodeBacking(bytes.slice(0));
    if (token !== this.token || audioToken !== this.audioToken || draft !== this.draft) return;
    Object.assign(draft, { audioBytes: bytes, buffer, audioName: file.name });
    this.q('b-import-state').textContent = 'Backing recording decoded. Offset and speed apply to both instrument parts.';
    } catch (error) { if (token === this.token && audioToken === this.audioToken) draft.audioFailed = true; throw error; }
    finally { if (audioToken === this.audioToken) draft.pendingAudio = false; }
  }
  metadata() {
    if (!this.draft) throw new Error('Choose a MIDI file first.');
    if (this.draft.pendingAudio || this.draft.audioFailed) throw new Error(this.draft.pendingAudio ? 'Wait for the backing recording to finish loading.' : 'Choose a supported backing recording, or remove the failed recording.');
    const q = this.q, chosen = [...q('b-import-tracks').querySelectorAll('[data-band-track]')];
    const parts = ['drums', 'keyboard'].map(instrument => ({ id: instrument, name: instrument === 'drums' ? 'Drums' : 'Piano / Keyboard', instrument, selected: chosen.filter(select => select.value === instrument).map(select => select.dataset.bandTrack) })).filter(part => part.selected.length);
    arrangementParts(parts);
    const title = q('b-import-title').value.trim();
    if (!title || title.length > 120 || /[\u0000-\u001f]/.test(title)) throw new Error('Enter a song title of 1–120 characters.');
    const alignment = validateAlignment(Number(q('b-import-offset').value), 100 / Number(q('b-import-speed').value)), volume = Number(q('b-import-volume').value) / 100;
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Choose a backing volume.');
    return { title, fileName: this.draft.fileName, audioName: this.draft.audioName, midiBytes: this.draft.bytes.byteLength, audioBytes: this.draft.audioBytes?.byteLength || 0, parts, selected: (parts.find(part => part.instrument === 'drums') || parts[0]).selected, mapping: { ...(this.draft.mapping ?? DEFAULT_MIDI_MAPPING) }, ...alignment, volume, arrangementVersion: 1 };
  }
  async apply() {
    const meta = this.metadata(), arrangement = importedArrangement(this.draft.song, meta);
    if (this.draft.buffer) arrangement.backing = { buffer: this.draft.buffer, offset: meta.offset, volume: meta.volume, name: meta.audioName };
    this.practice.stop(); this.practice.useArrangement(arrangement); this.q('b-import-state').textContent = 'Ready for local practice. Publish to school for other computers and saved account results.';
  }
  async publish() {
    const school = this.practice.school;
    if (!school.staff) throw new Error('Sign in as a teacher to publish an arrangement.');
    const meta = this.metadata(), draft = this.draft, token = this.token;
    importedArrangement(draft.song, meta); this.q('b-publish').disabled = true;
    let upload;
    try {
      this.q('b-import-state').textContent = 'Publishing the MIDI, backing and both part settings…';
      upload = await school.request('/library/uploads', { method: 'POST', data: { ...meta, ...draft.schoolSource } });
      const id = upload.uploadId;
      if (!id) throw new Error('The upload did not return a song revision.');
      await school.request('/library/uploads/' + id + '/midi', { method: 'PUT', data: draft.bytes });
      if (draft.audioBytes) await school.request('/library/uploads/' + id + '/audio', { method: 'PUT', data: draft.audioBytes });
      const published = await school.request('/library/uploads/' + id + '/publish', { method: 'POST', data: {} });
      if (token !== this.token) return;
      draft.schoolSource = { songId: published.song.id, revisionId: published.song.revisionId };
      this.q('b-publish').textContent = 'Publish school song update';
      await this.practice.refreshCatalog();
      await this.practice.loadChoice('school:' + published.song.id);
      this.q('b-import-state').textContent = 'Published to the school library. Both parts and backing settings travel together.';
    } finally { this.q('b-publish').disabled = false; }
  }
  downloadSetup() {
    const metadata = this.metadata(), setup = { format: 'groove-lab-arrangement', version: 1, fingerprint: this.draft.song.fingerprint, ...metadata };
    delete setup.midiBytes; delete setup.audioBytes;
    this.practice.download('arrangement-setup.json', JSON.stringify(setup, null, 2), 'application/json');
  }
  async loadSetup() {
    if (!this.draft) throw new Error('Load the matching MIDI first.');
    const file = this.q('b-setup-file').files[0]; if (!file) return;
    if (file.size > 65536) throw new Error('Choose a small arrangement setup JSON.');
    const token = this.token, setup = JSON.parse(await file.text()); if (token !== this.token) return;
    if (setup.format !== 'groove-lab-arrangement' || setup.version !== 1 || setup.fingerprint !== this.draft.song.fingerprint) throw new Error('This setup must match the exact MIDI file.');
    const parts = arrangementParts(setup.parts), assignment = new Map(parts.flatMap(part => part.selected.map(id => [id, part.instrument])));
    importedArrangement(this.draft.song, setup); validateAlignment(setup.offset, setup.timeScale);
    if (!Number.isFinite(setup.volume) || setup.volume < 0 || setup.volume > 1 || typeof setup.title !== 'string' || !setup.title.trim() || setup.title.length > 120) throw new Error('Invalid arrangement setup.');
    for (const select of this.q('b-import-tracks').querySelectorAll('[data-band-track]')) select.value = assignment.get(select.dataset.bandTrack) || '';
    if (setup.mapping !== undefined) {
      if (!setup.mapping || typeof setup.mapping !== 'object' || Array.isArray(setup.mapping) || Object.entries(setup.mapping).some(([pitch, drum]) => !/^\d{1,3}$/.test(pitch) || Number(pitch) > 127 || !Object.values(DEFAULT_MIDI_MAPPING).includes(drum) && drum !== 'ignore')) throw new Error('Invalid drum assignments in this setup.');
      this.draft.mapping = { ...setup.mapping };
    }
    this.q('b-import-title').value = setup.title; this.q('b-import-offset').value = setup.offset; this.q('b-import-speed').value = 100 / setup.timeScale; this.q('b-import-volume').value = setup.volume * 100;
    this.q('b-import-state').textContent = 'Arrangement settings restored. Add the matching backing recording, then use or publish.';
  }
}
