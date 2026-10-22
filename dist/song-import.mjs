import { DRUMS } from './engine.mjs';
import { parseMidiSong, pitchChoices, makeMidiChart, backingSchedule } from './midi.mjs';
import { createDemoMidi, createDemoWav } from './demo-data.mjs';
import { SongLibrary } from './song-library.mjs';
import { AudioSync } from './audio-sync.mjs';
import { alignMidiChart, validateAlignment } from './sync.mjs';

export function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
export function formatDuration(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }

export class SongImporter {
  constructor(audio, onApply) {
    this.audio = audio;
    this.onApply = onApply;
    this.applied = null;
    this.draft = null;
    this.busy = false;
    this.token = 0;
    this.library = new SongLibrary();
    this.libraryToken = 0;
    this.showArchived = false;
    this.libraryBusy = false;
    this.libraryScope = 'device';
    this.el = id => document.getElementById(id);
    this.dialog = this.el('import-dialog');
    this.el('midi-file').addEventListener('change', () => { const file = this.el('midi-file').files[0]; if (file) this.readMidi(file); });
    this.el('audio-file').addEventListener('change', () => { const file = this.el('audio-file').files[0]; if (file) this.readAudio(file); });
    this.el('midi-parts').addEventListener('change', () => {
      if (!this.draft) return;
      this.draft.selected = [...this.el('midi-parts').querySelectorAll('input:checked')].map(input => input.value);
      this.sync.stop(); this.renderMapping(); this.renderSummary(); this.sync.reset(); this.sync.render();
    });
    this.el('midi-mapping').addEventListener('change', event => {
      if (!this.draft || !event.target.dataset.pitch) return;
      this.draft.mapping[event.target.dataset.pitch] = event.target.value;
      this.sync.stop(); this.renderSummary(); this.sync.reset(); this.sync.render();
    });
    this.el('audio-offset').addEventListener('input', () => { if (this.draft) { this.sync.stop(); this.draft.offset = Number(this.el('audio-offset').value); this.renderSummary(); this.sync.render(); } });
    this.el('backing-volume').addEventListener('input', () => { if (this.draft) { this.draft.volume = Number(this.el('backing-volume').value) / 100; this.el('backing-volume-value').textContent = `${this.el('backing-volume').value}%`; } });
    this.el('remove-audio').addEventListener('click', () => { if (this.draft) { this.sync.stop(); this.draft.buffer = null; this.draft.audioName = ''; this.draft.audioBytes = null; this.el('audio-file').value = ''; this.sync.reset(); this.render(); } });
    this.el('use-song').addEventListener('click', () => this.apply());
    this.el('demo-song').addEventListener('click', () => this.loadDemo());
    this.el('save-song').addEventListener('click', () => this.saveSong());
    this.el('publish-song').addEventListener('click', () => this.publishSong());
    this.el('school-song-title').addEventListener('input', () => { if (this.draft) this.draft.schoolTitle = this.el('school-song-title').value; });
    for (const scope of ['school', 'device']) this.el(`library-${scope}`).addEventListener('click', () => { this.libraryScope = scope; this.showArchived = false; this.renderLibrary(); });
    this.el('export-song-setup').addEventListener('click', () => this.exportSetup());
    this.el('import-song-setup').addEventListener('change', () => { const file = this.el('import-song-setup').files[0]; if (file) this.importSetup(file); });
    this.el('library-import').addEventListener('click', () => { this.el('library-dialog').close(); this.open(); });
    this.el('show-archived').addEventListener('click', () => { this.showArchived = !this.showArchived; this.renderLibrary(); });
    this.el('library-list').addEventListener('click', event => {
      const button = event.target.closest('button[data-song]');
      if (!button || this.libraryBusy) return;
      if (button.dataset.action === 'load') this.libraryScope === 'school' ? this.loadSchoolSong(button.dataset.song) : this.loadSavedSong(button.dataset.song);
      else if (button.dataset.action === 'keyboard' || button.dataset.action === 'parts') {
        this.el('library-dialog').close();
        window.dispatchEvent(new CustomEvent(button.dataset.action === 'parts' ? 'band-edit-school' : 'band-load-school', { detail: { id: button.dataset.song } }));
      }
      else if (button.dataset.action === 'publish') this.publishDeviceSong(button.dataset.song);
      else if (button.dataset.action === 'archive') this.archiveSong(button.dataset.song, !this.showArchived);
    });
    this.el('library-dialog').addEventListener('close', () => { this.libraryToken++; this.libraryBusy = false; });
    this.dialog.addEventListener('close', () => { this.token++; this.busy = false; this.publishController?.abort(); });
    this.sync = new AudioSync(this);
  }
  copyDraft(draft) { return draft ? { ...draft, selected: [...draft.selected], mapping: { ...draft.mapping } } : null; }
  setSchool(school) {
    this.school = school; this.libraryScope = school.user ? 'school' : 'device'; this.libraryToken++; this.showArchived = false;
    this.el('library-school').hidden = !school.user; this.el('library-device').hidden = school.user?.role === 'student';
    this.el('school-publish-section').hidden = !school.staff;
    this.el('library-import').hidden = school.user?.role === 'student';
  }
  open() {
    this.token++;
    this.busy = false;
    this.draft = this.copyDraft(this.applied);
    this.el('midi-file').value = ''; this.el('audio-file').value = '';
    this.message(''); this.sync.reset(); this.render(); this.dialog.showModal(); this.sync.draw();
  }
  message(text, error = false) { this.el('import-status').textContent = text; this.el('import-status').classList.toggle('error', error); }
  profile(song) {
    try { return JSON.parse(localStorage.getItem('groove-lab-song-preferences') || '{}')?.[song.fingerprint] || {}; }
    catch { return {}; }
  }
  makeDraft(song) {
    const profile = this.profile(song);
    const selected = Array.isArray(profile.selected) ? profile.selected.filter(id => song.parts.some(part => part.id === id)) : song.selected;
    const mapping = {};
    for (const [pitch, drum] of Object.entries(profile.mapping || {})) if (/^\d{1,3}$/.test(pitch) && (drum === 'ignore' || DRUMS.some(item => item.id === drum))) mapping[pitch] = drum;
    for (const part of song.parts.filter(part => part.rhythmGame)) for (const note of part.notes) if (!(note.pitch in mapping)) mapping[note.pitch] = 'ignore';
    return { song, selected: selected.length ? selected : song.selected, mapping, buffer: null, audioName: '', midiBytes: null, audioBytes: null, libraryId: null, timeScale: Number.isFinite(profile.timeScale) && profile.timeScale >= 0.5 && profile.timeScale <= 2 ? profile.timeScale : 1, offset: Number.isFinite(profile.offset) && Math.abs(profile.offset) <= 300 ? profile.offset : 0, volume: Number.isFinite(profile.volume) && profile.volume >= 0 && profile.volume <= 1 ? profile.volume : 0.65 };
  }
  async readMidi(file) {
    this.sync.stop();
    const token = ++this.token;
    this.busy = true; this.draft = null; this.render(); this.message('Reading MIDI…');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a MIDI file smaller than 10 MB.');
      const bytes = await file.arrayBuffer();
      if (token !== this.token) return;
      this.draft = this.makeDraft(parseMidiSong(bytes, file.name));
      this.draft.midiBytes = bytes;
      this.sync.reset();
      this.message('MIDI loaded. Check the selected parts and note assignments below.');
    } catch (error) { if (token === this.token) this.message(error.message, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  async readAudio(file) {
    if (!this.draft || this.busy) return;
    this.sync.stop();
    const token = ++this.token;
    this.busy = true; this.render(); this.message('Preparing backing audio…');
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Choose a backing audio file smaller than 100 MB.');
      const bytes = await file.arrayBuffer();
      if (token !== this.token) return;
      const buffer = await this.audio.decodeBacking(bytes.slice(0));
      if (token !== this.token) return;
      if (buffer.duration > 1200) throw new Error('Choose a backing recording shorter than 20 minutes.');
      this.draft.buffer = buffer; this.draft.audioName = file.name; this.draft.audioBytes = bytes;
      this.sync.reset(); this.el('audio-sync').open = true;
      this.message('Backing audio ready. Open Sync audio & MIDI for a suggested match or a manual beat match.');
    } catch (error) { if (token === this.token) this.message(error.message, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  async loadDemo() {
    this.sync.stop();
    const token = ++this.token;
    this.busy = true; this.render(); this.message('Preparing the sample MIDI and matching recording…');
    try {
      const midiBytes = createDemoMidi().buffer;
      const draft = this.makeDraft(parseMidiSong(midiBytes, 'Groove Lab sample.mid'));
      draft.midiBytes = midiBytes;
      draft.offset = 0;
      draft.timeScale = 1;
      draft.audioBytes = createDemoWav();
      draft.buffer = await this.audio.decodeBacking(draft.audioBytes.slice(0));
      draft.audioName = 'Groove Lab sample backing.wav';
      if (token !== this.token) return;
      this.draft = draft;
      this.sync.reset();
      this.message('Sample ready: a drum part, a bass part, a tempo change, and a matching drumless recording.');
    } catch (error) { if (token === this.token) this.message(error.message, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  render() {
    const draft = this.draft;
    this.el('demo-song').disabled = this.busy;
    this.el('midi-file').disabled = this.busy;
    this.el('export-song-setup').disabled = !draft || this.busy;
    this.el('import-song-setup').disabled = !draft || this.busy;
    this.el('audio-file').disabled = !draft || this.busy;
    this.el('song-details').hidden = !draft;
    this.el('midi-file-name').textContent = draft?.song.fileName || 'No MIDI selected';
    this.el('audio-file-name').textContent = draft?.audioName || 'Optional · MP3, WAV, or another browser-supported audio file';
    this.el('remove-audio').disabled = !draft?.buffer || this.busy;
    this.el('audio-offset').disabled = !draft?.buffer || this.busy;
    this.el('backing-volume').disabled = !draft?.buffer || this.busy;
    this.el('midi-parts').querySelectorAll('input').forEach(input => { input.disabled = this.busy; });
    this.el('audio-offset').value = draft?.offset ?? 0;
    this.el('backing-volume').value = Math.round((draft?.volume ?? 0.65) * 100);
    this.el('backing-volume-value').textContent = `${this.el('backing-volume').value}%`;
    this.el('school-publish-section').hidden = !this.school?.staff;
    this.el('school-song-title').disabled = !draft || this.busy;
    this.el('school-song-title').value = draft?.schoolTitle ?? draft?.song.title.slice(0, 120) ?? '';
    if (draft) {
      this.el('midi-parts').innerHTML = draft.song.parts.map(part => `<label class="part-choice"><input type="checkbox" value="${part.id}" ${draft.selected.includes(part.id) ? 'checked' : ''}><span><strong>${escapeHtml(part.name)}</strong><small>Track ${part.track} · Channel ${part.channel} · ${part.notes.length} notes${part.drumCandidate ? ' · Suggested drums' : ''}</small></span></label>`).join('');
      this.el('midi-detection-note').textContent = draft.song.parts.some(part => part.rhythmGame) ? 'This looks like a rhythm-game chart. Difficulty and cymbal markers are not interpreted yet; notes from PART DRUMS start as Ignore. Use a General MIDI file, or assign only the chart notes you need.' : draft.song.parts.some(part => part.channel === 10) ? 'Channel 10 is the usual General MIDI percussion channel. Select all parts that belong to the drum performance.' : 'No General MIDI percussion channel was found. Check the suggested part carefully; pitched instruments can use the same MIDI note numbers.';
      this.renderMapping();
      this.el('midi-parts').querySelectorAll('input').forEach(input => { input.disabled = this.busy; });
    }
    this.renderSummary();
    this.sync?.render();
  }
  renderMapping() {
    const { song, selected, mapping } = this.draft;
    this.el('midi-mapping').innerHTML = pitchChoices(song, selected).map(item => `<label class="pitch-choice"><span><strong>${item.pitch} <span>${escapeHtml(item.name)}</span></strong><small>${item.count} strike${item.count === 1 ? '' : 's'}</small></span><select data-pitch="${item.pitch}" aria-label="MIDI note ${item.pitch} drum assignment" ${this.busy ? 'disabled' : ''}>${[{ id: 'ignore', name: 'Ignore this note' }, ...DRUMS].map(drum => `<option value="${drum.id}" ${(mapping[item.pitch] ?? item.defaultDrum) === drum.id ? 'selected' : ''}>${drum.name}</option>`).join('')}</select></label>`).join('');
  }
  exportSetup() {
    if (!this.draft || this.busy) return;
    try {
      const d = this.draft;
      validateAlignment(d.offset, d.timeScale ?? 1); alignMidiChart(makeMidiChart(d.song, d.selected, d.mapping), d.timeScale ?? 1);
      const setup = { format: 'groove-lab-song-setup', version: 1, fingerprint: d.song.fingerprint, midiFile: d.song.fileName, audioFile: d.audioName, selected: d.selected, mapping: d.mapping, offset: d.offset, timeScale: d.timeScale ?? 1, volume: d.volume };
      const url = URL.createObjectURL(new Blob([JSON.stringify(setup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${d.song.title.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)}-setup.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.message('Setup downloaded. Take it and the original MIDI/audio files to your other computer. The setup contains no music files.');
    } catch (error) { this.message(error.message, true); }
  }
  async importSetup(file) {
    if (!this.draft || this.busy) return;
    const token = this.token;
    try {
      if (file.size > 65536) throw new Error('Choose a Groove Lab setup JSON smaller than 64 KB.');
      const setup = JSON.parse(await file.text());
      if (token !== this.token) return;
      if (setup.format !== 'groove-lab-song-setup' || setup.version !== 1 || setup.fingerprint !== this.draft.song.fingerprint) throw new Error('This setup belongs to a different MIDI file. Import the exact original MIDI first.');
      validateAlignment(setup.offset, setup.timeScale);
      if (!Array.isArray(setup.selected) || !setup.selected.every(id => this.draft.song.parts.some(part => part.id === id)) || !setup.mapping || typeof setup.mapping !== 'object' || Array.isArray(setup.mapping) || !Object.entries(setup.mapping).every(([pitch, drum]) => /^\d{1,3}$/.test(pitch) && (drum === 'ignore' || DRUMS.some(item => item.id === drum))) || !Number.isFinite(setup.volume) || setup.volume < 0 || setup.volume > 1) throw new Error('This setup has invalid drum assignments or volume.');
      alignMidiChart(makeMidiChart(this.draft.song, setup.selected, setup.mapping), setup.timeScale);
      if (this.draft.buffer) backingSchedule(0, setup.offset, this.draft.buffer.duration);
      this.sync.stop(); Object.assign(this.draft, { selected: [...setup.selected], mapping: { ...setup.mapping }, offset: setup.offset, timeScale: setup.timeScale, volume: setup.volume });
      this.sync.reset(); this.render();
      this.message(`Song setup restored. Use the matching recording${setup.audioFile ? ` (${setup.audioFile})` : ''}, then preview the alignment.`);
    } catch (error) { if (token === this.token) this.message(`Could not load setup: ${error.message}`, true); }
    finally { this.el('import-song-setup').value = ''; }
  }
  renderSummary() {
    this.el('use-song').disabled = true;
    this.el('save-song').disabled = true;
    this.el('publish-song').disabled = true;
    this.el('save-song').textContent = this.draft?.libraryId ? 'Update device copy' : 'Save on this device';
    this.el('publish-song').textContent = this.draft?.schoolSource?.canManage ? 'Update school song' : 'Publish to school';
    if (!this.draft) { this.el('import-summary').textContent = 'Choose a MIDI file or try the sample song.'; return; }
    try {
      const { song, selected, mapping, buffer, offset } = this.draft;
      validateAlignment(offset, this.draft.timeScale ?? 1);
      const chart = alignMidiChart(makeMidiChart(song, selected, mapping), this.draft.timeScale ?? 1);
      if (buffer) backingSchedule(0, offset, buffer.duration);
      this.el('import-summary').textContent = `${chart.notes.length} playable hits · ${formatDuration(chart.duration)} · ${Math.round(chart.bpm)} BPM${chart.tempoChanges ? ` + ${chart.tempoChanges} tempo change${chart.tempoChanges === 1 ? '' : 's'}` : ''} · ${chart.numerator}/${chart.denominator}${chart.signatureChanges ? ' with meter changes' : ''}${chart.ignored ? ` · ${chart.ignored} ignored notes` : ''}${chart.combined ? ` · ${chart.combined} duplicate hits combined` : ''}${buffer ? ` · Audio ${formatDuration(buffer.duration)}` : ' · No backing audio'}`;
      this.el('use-song').disabled = this.busy;
      this.el('save-song').disabled = this.busy;
      this.el('publish-song').disabled = this.busy || !this.school?.staff;
    } catch (error) { this.el('import-summary').textContent = error.message; }
  }
  async saveSong() {
    if (!this.draft || this.busy) return;
    const draft = this.draft;
    const token = ++this.token;
    this.busy = true; this.render(); this.message('Saving MIDI, backing audio, and song setup in this browser…');
    try {
      validateAlignment(draft.offset, draft.timeScale ?? 1);
      const chart = alignMidiChart(makeMidiChart(draft.song, draft.selected, draft.mapping), draft.timeScale ?? 1);
      if (draft.buffer) backingSchedule(0, draft.offset, draft.buffer.duration);
      draft.libraryId = await this.library.save(draft, chart);
      if (token === this.token) this.message('Saved in this browser. Open Song library to play it again after a refresh.');
    } catch (error) {
      if (token === this.token) this.message(error.name === 'QuotaExceededError' ? 'This browser has no room for that song. You can still use it for this visit; try a smaller recording to save.' : `Could not save: ${error.message} You can still use this song for this visit.`, true);
    } finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  async publishSong() {
    if (!this.draft || this.busy || !this.school?.staff) return;
    const token = ++this.token, draft = this.draft; this.busy = true; this.publishController = new AbortController(); this.render();
    try {
      if (draft.buffer) backingSchedule(0, draft.offset, draft.buffer.duration);
      const song = await this.school.saveSong(draft, message => { if (token === this.token) this.message(message); }, { signal: this.publishController.signal });
      if (token !== this.token) return;
      draft.schoolSource = { schoolId: this.school.schoolId, songId: song.id, revisionId: song.revisionId, canManage: true };
      draft.schoolTitle = song.title;
      draft.song.title = song.title;
      if (draft.libraryId) await this.library.linkSchool(draft.libraryId, `${this.school.schoolId}:${this.school.user.id}`, draft.schoolSource);
      this.message('Published to the school library. Every signed-in student can practice this song from any computer.');
    } catch (error) { if (token === this.token) this.message(`Could not publish: ${error.message}`, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } this.publishController = null; }
  }
  openLibrary() {
    this.showArchived = false;
    this.el('library-dialog').showModal();
    this.renderLibrary();
  }
  async renderLibrary() {
    const token = ++this.libraryToken;
    this.libraryBusy = true;
    this.el('library-list').textContent = 'Opening your songs…';
    this.el('library-status').textContent = '';
    this.el('show-archived').textContent = this.showArchived ? 'Show saved songs' : 'Show archived songs';
    this.el('show-archived').disabled = true;
    const shared = this.libraryScope === 'school' && this.school?.user;
    this.el('library-school').setAttribute('aria-pressed', String(Boolean(shared))); this.el('library-device').setAttribute('aria-pressed', String(!shared));
    this.el('show-archived').hidden = Boolean(shared && !this.school.staff);
    this.el('library-description').textContent = shared ? 'Teacher-published MIDI, backing audio and sync settings, available to every signed-in student at this school.' : 'Songs saved in this browser on this device. Teachers can publish individual songs to the school library.';
    this.el('library-help').textContent = shared ? 'School songs and account results are stored by the school website. Teachers manage their own songs; students can practice all published songs.' : 'Device songs do not travel between computers. Keep your original files, or sign in as a teacher and Publish to school. Archiving retains the files.';
    try {
      const songs = shared ? (await this.school.request(`/library${this.showArchived ? '?archived=true' : ''}`)).songs : await this.library.list(this.showArchived);
      if (token !== this.libraryToken) return;
      this.el('library-list').innerHTML = songs.length ? songs.map(song => `<article class="library-song"><div><h3>${escapeHtml(song.title)}</h3><p>${song.notes} hits · ${formatDuration(song.duration)} · ${(song.bytes / 1024 / 1024).toFixed(1)} MB</p><small>${escapeHtml(song.audioName || 'MIDI only · no backing audio')}${shared ? ` · Published by ${escapeHtml(song.ownerName)}` : ''}${song.parts?.some(part => part.instrument === 'keyboard') ? ' · Piano / Keyboard' : ''}</small></div><div class="library-song-actions">${this.showArchived ? '' : `<button class="button secondary" data-action="load" data-song="${escapeHtml(song.id)}" aria-label="Load ${escapeHtml(song.title)}">${shared && !this.school.staff ? 'Practice' : 'Load song'} →</button>`}${shared && !this.showArchived && song.parts?.some(part => part.instrument === 'keyboard') ? `<button class="button secondary" data-action="keyboard" data-song="${escapeHtml(song.id)}">Practice keyboard</button>` : ''}${shared && !this.showArchived && song.canManage ? `<button class="text-button" data-action="parts" data-song="${escapeHtml(song.id)}">Edit instrument parts</button>` : ''}${!shared || song.canManage ? `<button class="text-button" data-action="archive" data-song="${escapeHtml(song.id)}" aria-label="${this.showArchived ? 'Restore' : 'Archive'} ${escapeHtml(song.title)}">${this.showArchived ? 'Restore' : 'Archive'}</button>` : ''}${!shared && !this.showArchived && this.school?.staff ? `<button class="text-button" data-action="publish" data-song="${escapeHtml(song.id)}">Publish to school</button>` : ''}</div></article>`).join('') : `<p class="library-empty">${this.showArchived ? 'No archived songs.' : shared ? this.school.staff ? 'Publish a song from Import song, or open This device to publish an existing saved song.' : 'Your teachers have not published any songs yet. The built-in tracks are ready to practice.' : 'Import a MIDI file, add audio if you have it, then choose Save on this device.'}</p>`;
    } catch (error) { if (token === this.libraryToken) { this.el('library-list').textContent = ''; this.el('library-status').textContent = error.message; } }
    finally { if (token === this.libraryToken) { this.libraryBusy = false; this.el('show-archived').disabled = false; } }
  }
  async loadSavedSong(id) {
    const token = ++this.libraryToken;
    this.libraryBusy = true;
    this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
    this.el('show-archived').disabled = true;
    this.el('library-status').textContent = 'Preparing your saved song…';
    try {
      const savedSong = await this.library.get(id);
      if (token !== this.libraryToken) return;
      if (!savedSong) throw new Error('That song is no longer available. Reimport its files.');
      const draft = this.makeDraft(parseMidiSong(savedSong.midiBytes, savedSong.fileName));
      Object.assign(draft, { midiBytes: savedSong.midiBytes, audioBytes: savedSong.audioBytes, audioName: savedSong.audioName, selected: savedSong.selected, mapping: savedSong.mapping, offset: savedSong.offset, timeScale: savedSong.timeScale ?? 1, volume: savedSong.volume, libraryId: id });
      const linked = this.school?.staff && savedSong.schoolLinks?.[`${this.school.schoolId}:${this.school.user.id}`];
      if (linked) draft.schoolSource = { ...linked, canManage: true };
      if (draft.audioBytes) draft.buffer = await this.audio.decodeBacking(draft.audioBytes.slice(0));
      if (token !== this.libraryToken) return;
      this.token++; this.busy = false; this.draft = draft;
      this.el('midi-file').value = ''; this.el('audio-file').value = '';
      this.message('Saved song ready, including its drum assignments and backing setup.');
      this.sync.reset(); this.render();
      if (this.apply()) this.el('library-dialog').close();
    } catch (error) {
      if (token === this.libraryToken) {
        this.el('library-status').textContent = `Could not open: ${error.message}`;
        this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    } finally { if (token === this.libraryToken) { this.libraryBusy = false; this.el('show-archived').disabled = false; this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); } }
  }
  async loadSchoolSong(id) {
    const token = ++this.libraryToken; this.libraryBusy = true;
    this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; }); this.el('library-status').textContent = 'Downloading the school song…';
    try {
      const meta = (await this.school.request(`/library/${id}`)).song;
      if (token !== this.libraryToken) return;
      if (meta.parts?.length && (!meta.parts.some(part => part.instrument === 'drums') || this.bandActive?.() && meta.parts.some(part => part.instrument === 'keyboard'))) {
        this.el('library-dialog').close();
        window.dispatchEvent(new CustomEvent('band-load-school', { detail: { id } }));
        return;
      }
      const midiBytes = await this.school.download(`/library/${id}/revisions/${meta.revisionId}/midi`);
      if (token !== this.libraryToken) return;
      const audioBytes = meta.audioName ? await this.school.download(`/library/${id}/revisions/${meta.revisionId}/audio`) : null;
      if (token !== this.libraryToken) return;
      const draft = this.makeDraft(parseMidiSong(midiBytes, meta.fileName)); draft.song.title = meta.title;
      draft.arrangementParts = meta.parts || null;
      Object.assign(draft, { midiBytes, audioBytes, audioName: meta.audioName, selected: meta.selected, mapping: meta.mapping, offset: meta.offset, timeScale: meta.timeScale, volume: meta.volume, schoolTitle: meta.title, schoolSource: { schoolId: this.school.schoolId, songId: id, revisionId: meta.revisionId, canManage: meta.canManage } });
      if (audioBytes) draft.buffer = await this.audio.decodeBacking(audioBytes.slice(0));
      if (token !== this.libraryToken) return;
      alignMidiChart(makeMidiChart(draft.song, draft.selected, draft.mapping), draft.timeScale);
      if (draft.buffer) backingSchedule(0, draft.offset, draft.buffer.duration);
      this.token++; this.busy = false; this.draft = draft;
      this.el('midi-file').value = ''; this.el('audio-file').value = ''; this.sync.reset(); this.render();
      if (this.apply()) this.el('library-dialog').close();
    } catch (error) { if (token === this.libraryToken) { this.el('library-status').textContent = error.message; this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); } }
    finally { if (token === this.libraryToken) { this.libraryBusy = false; this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); } }
  }
  async publishDeviceSong(id) {
    if (!this.school?.staff || this.libraryBusy) return;
    const token = ++this.libraryToken; this.libraryBusy = true; this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const saved = await this.library.get(id); if (!saved) throw new Error('That device song is unavailable.');
      if (token !== this.libraryToken) return;
      const draft = this.makeDraft(parseMidiSong(saved.midiBytes, saved.fileName));
      Object.assign(draft, { midiBytes: saved.midiBytes, audioBytes: saved.audioBytes, audioName: saved.audioName, selected: saved.selected, mapping: saved.mapping, offset: saved.offset, timeScale: saved.timeScale ?? 1, volume: saved.volume });
      const key = `${this.school.schoolId}:${this.school.user.id}`, linked = saved.schoolLinks?.[key]; if (linked) draft.schoolSource = { ...linked, canManage: true };
      const song = await this.school.saveSong(draft, message => { if (token === this.libraryToken) this.el('library-status').textContent = message; });
      if (token !== this.libraryToken) return;
      await this.library.linkSchool(id, key, { schoolId: this.school.schoolId, songId: song.id, revisionId: song.revisionId, canManage: true });
      if (token === this.libraryToken) this.el('library-status').textContent = 'Published to the school library. The device copy is still available here.';
    } catch (error) { if (token === this.libraryToken) this.el('library-status').textContent = error.message; }
    finally { if (token === this.libraryToken) { this.libraryBusy = false; this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; }); } }
  }
  async archiveSong(id, archived) {
    this.libraryBusy = true;
    const token = ++this.libraryToken;
    this.el('show-archived').disabled = true;
    this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      if (this.libraryScope === 'school') await this.school.request(`/library/${id}/archive`, { method: 'POST', data: { archived } });
      else await this.library.archive(id, archived);
      if (token !== this.libraryToken) return;
      await this.renderLibrary();
      this.el('library-status').textContent = archived ? 'Song archived. Use Show archived songs to restore it any time.' : 'Song restored to your library.';
    } catch (error) {
      if (token === this.libraryToken) {
        this.el('library-status').textContent = error.message;
        this.libraryBusy = false; this.el('show-archived').disabled = false;
        this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    }
  }
  apply() {
    if (!this.draft || this.busy) return;
    try {
      validateAlignment(this.draft.offset, this.draft.timeScale ?? 1);
      const chart = alignMidiChart(makeMidiChart(this.draft.song, this.draft.selected, this.draft.mapping), this.draft.timeScale ?? 1);
      if (this.draft.buffer) backingSchedule(0, this.draft.offset, this.draft.buffer.duration);
      this.applied = this.copyDraft(this.draft);
      try {
        const existing = JSON.parse(localStorage.getItem('groove-lab-song-preferences') || '{}');
        const profiles = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
        delete profiles[this.draft.song.fingerprint];
        profiles[this.draft.song.fingerprint] = { selected: this.draft.selected, mapping: this.draft.mapping, offset: this.draft.offset, timeScale: this.draft.timeScale ?? 1, volume: this.draft.volume };
        localStorage.setItem('groove-lab-song-preferences', JSON.stringify(Object.fromEntries(Object.entries(profiles).slice(-10))));
      } catch { /* Song files remain usable when browser storage is unavailable. */ }
      this.onApply({ chart, song: this.draft.song, schoolSource: this.draft.schoolSource || null, backing: this.draft.buffer ? { buffer: this.draft.buffer, name: this.draft.audioName, offset: this.draft.offset, volume: this.draft.volume } : null });
      this.dialog.close();
      return true;
    } catch (error) { this.message(error.message, true); if (this.el('library-dialog').open) this.el('library-status').textContent = error.message; return false; }
  }
  setPlaybackVolume(volume) {
    if (!this.applied) return;
    this.applied.volume = volume;
    if (this.draft?.song.fingerprint === this.applied.song.fingerprint) this.draft.volume = volume;
  }
}
