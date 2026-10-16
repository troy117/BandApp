import { DRUMS } from './engine.mjs';
import { parseMidiSong, pitchChoices, makeMidiChart, backingSchedule } from './midi.mjs';
import { createDemoMidi, createDemoWav } from './demo-data.mjs';
import { SongLibrary } from './song-library.mjs';

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
    this.el = id => document.getElementById(id);
    this.dialog = this.el('import-dialog');
    this.el('midi-file').addEventListener('change', () => { const file = this.el('midi-file').files[0]; if (file) this.readMidi(file); });
    this.el('audio-file').addEventListener('change', () => { const file = this.el('audio-file').files[0]; if (file) this.readAudio(file); });
    this.el('midi-parts').addEventListener('change', () => {
      if (!this.draft) return;
      this.draft.selected = [...this.el('midi-parts').querySelectorAll('input:checked')].map(input => input.value);
      this.renderMapping(); this.renderSummary();
    });
    this.el('midi-mapping').addEventListener('change', event => {
      if (!this.draft || !event.target.dataset.pitch) return;
      this.draft.mapping[event.target.dataset.pitch] = event.target.value;
      this.renderSummary();
    });
    this.el('audio-offset').addEventListener('input', () => { if (this.draft) { this.draft.offset = Number(this.el('audio-offset').value); this.renderSummary(); } });
    this.el('backing-volume').addEventListener('input', () => { if (this.draft) { this.draft.volume = Number(this.el('backing-volume').value) / 100; this.el('backing-volume-value').textContent = `${this.el('backing-volume').value}%`; } });
    this.el('remove-audio').addEventListener('click', () => { if (this.draft) { this.draft.buffer = null; this.draft.audioName = ''; this.draft.audioBytes = null; this.el('audio-file').value = ''; this.render(); } });
    this.el('use-song').addEventListener('click', () => this.apply());
    this.el('demo-song').addEventListener('click', () => this.loadDemo());
    this.el('save-song').addEventListener('click', () => this.saveSong());
    this.el('library-import').addEventListener('click', () => { this.el('library-dialog').close(); this.open(); });
    this.el('show-archived').addEventListener('click', () => { this.showArchived = !this.showArchived; this.renderLibrary(); });
    this.el('library-list').addEventListener('click', event => {
      const button = event.target.closest('button[data-song]');
      if (!button || this.libraryBusy) return;
      if (button.dataset.action === 'load') this.loadSavedSong(button.dataset.song);
      else this.archiveSong(button.dataset.song, !this.showArchived);
    });
    this.el('library-dialog').addEventListener('close', () => { this.libraryToken++; this.libraryBusy = false; });
    this.dialog.addEventListener('close', () => { this.token++; this.busy = false; });
  }
  copyDraft(draft) { return draft ? { ...draft, selected: [...draft.selected], mapping: { ...draft.mapping } } : null; }
  open() {
    this.token++;
    this.busy = false;
    this.draft = this.copyDraft(this.applied);
    this.el('midi-file').value = ''; this.el('audio-file').value = '';
    this.message(''); this.render(); this.dialog.showModal();
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
    return { song, selected: selected.length ? selected : song.selected, mapping, buffer: null, audioName: '', midiBytes: null, audioBytes: null, libraryId: null, offset: Number.isFinite(profile.offset) && Math.abs(profile.offset) <= 300 ? profile.offset : 0, volume: Number.isFinite(profile.volume) && profile.volume >= 0 && profile.volume <= 1 ? profile.volume : 0.65 };
  }
  async readMidi(file) {
    const token = ++this.token;
    this.busy = true; this.draft = null; this.render(); this.message('Reading MIDI…');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a MIDI file smaller than 10 MB.');
      const bytes = await file.arrayBuffer();
      if (token !== this.token) return;
      this.draft = this.makeDraft(parseMidiSong(bytes, file.name));
      this.draft.midiBytes = bytes;
      this.message('MIDI loaded. Check the selected parts and note assignments below.');
    } catch (error) { if (token === this.token) this.message(error.message, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  async readAudio(file) {
    if (!this.draft || this.busy) return;
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
      this.message('Backing audio ready. Use Listen first after loading to check alignment.');
    } catch (error) { if (token === this.token) this.message(error.message, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  async loadDemo() {
    const token = ++this.token;
    this.busy = true; this.render(); this.message('Preparing the sample MIDI and matching recording…');
    try {
      const midiBytes = createDemoMidi().buffer;
      const draft = this.makeDraft(parseMidiSong(midiBytes, 'Groove Lab sample.mid'));
      draft.midiBytes = midiBytes;
      draft.offset = 0;
      draft.audioBytes = createDemoWav();
      draft.buffer = await this.audio.decodeBacking(draft.audioBytes.slice(0));
      draft.audioName = 'Groove Lab sample backing.wav';
      if (token !== this.token) return;
      this.draft = draft;
      this.message('Sample ready: a drum part, a bass part, a tempo change, and a matching drumless recording.');
    } catch (error) { if (token === this.token) this.message(error.message, true); }
    finally { if (token === this.token) { this.busy = false; this.render(); } }
  }
  render() {
    const draft = this.draft;
    this.el('demo-song').disabled = this.busy;
    this.el('midi-file').disabled = this.busy;
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
    if (draft) {
      this.el('midi-parts').innerHTML = draft.song.parts.map(part => `<label class="part-choice"><input type="checkbox" value="${part.id}" ${draft.selected.includes(part.id) ? 'checked' : ''}><span><strong>${escapeHtml(part.name)}</strong><small>Track ${part.track} · Channel ${part.channel} · ${part.notes.length} notes${part.drumCandidate ? ' · Suggested drums' : ''}</small></span></label>`).join('');
      this.el('midi-detection-note').textContent = draft.song.parts.some(part => part.rhythmGame) ? 'This looks like a rhythm-game chart. Difficulty and cymbal markers are not interpreted yet; notes from PART DRUMS start as Ignore. Use a General MIDI file, or assign only the chart notes you need.' : draft.song.parts.some(part => part.channel === 10) ? 'Channel 10 is the usual General MIDI percussion channel. Select all parts that belong to the drum performance.' : 'No General MIDI percussion channel was found. Check the suggested part carefully; pitched instruments can use the same MIDI note numbers.';
      this.renderMapping();
      this.el('midi-parts').querySelectorAll('input').forEach(input => { input.disabled = this.busy; });
    }
    this.renderSummary();
  }
  renderMapping() {
    const { song, selected, mapping } = this.draft;
    this.el('midi-mapping').innerHTML = pitchChoices(song, selected).map(item => `<label class="pitch-choice"><span><strong>${item.pitch} <span>${escapeHtml(item.name)}</span></strong><small>${item.count} strike${item.count === 1 ? '' : 's'}</small></span><select data-pitch="${item.pitch}" aria-label="MIDI note ${item.pitch} drum assignment" ${this.busy ? 'disabled' : ''}>${[{ id: 'ignore', name: 'Ignore this note' }, ...DRUMS].map(drum => `<option value="${drum.id}" ${(mapping[item.pitch] ?? item.defaultDrum) === drum.id ? 'selected' : ''}>${drum.name}</option>`).join('')}</select></label>`).join('');
  }
  renderSummary() {
    this.el('use-song').disabled = true;
    this.el('save-song').disabled = true;
    this.el('save-song').textContent = this.draft?.libraryId ? 'Update saved song' : 'Save to library';
    if (!this.draft) { this.el('import-summary').textContent = 'Choose a MIDI file or try the sample song.'; return; }
    try {
      const { song, selected, mapping, buffer, offset } = this.draft;
      if (!Number.isFinite(offset) || Math.abs(offset) > 300) throw new Error('Choose an audio offset between −300 and +300 seconds.');
      const chart = makeMidiChart(song, selected, mapping);
      if (buffer) backingSchedule(0, offset, buffer.duration);
      this.el('import-summary').textContent = `${chart.notes.length} playable hits · ${formatDuration(chart.duration)} · ${Math.round(chart.bpm)} BPM${chart.tempoChanges ? ` + ${chart.tempoChanges} tempo change${chart.tempoChanges === 1 ? '' : 's'}` : ''} · ${chart.numerator}/${chart.denominator}${chart.signatureChanges ? ' with meter changes' : ''}${chart.ignored ? ` · ${chart.ignored} ignored notes` : ''}${chart.combined ? ` · ${chart.combined} duplicate hits combined` : ''}${buffer ? ` · Audio ${formatDuration(buffer.duration)}` : ' · No backing audio'}`;
      this.el('use-song').disabled = this.busy;
      this.el('save-song').disabled = this.busy;
    } catch (error) { this.el('import-summary').textContent = error.message; }
  }
  async saveSong() {
    if (!this.draft || this.busy) return;
    const draft = this.draft;
    const token = ++this.token;
    this.busy = true; this.render(); this.message('Saving MIDI, backing audio, and song setup in this browser…');
    try {
      const chart = makeMidiChart(draft.song, draft.selected, draft.mapping);
      if (!Number.isFinite(draft.offset) || Math.abs(draft.offset) > 300) throw new Error('Choose an audio offset between −300 and +300 seconds.');
      if (draft.buffer) backingSchedule(0, draft.offset, draft.buffer.duration);
      draft.libraryId = await this.library.save(draft, chart);
      if (token === this.token) this.message('Saved in this browser. Open Song library to play it again after a refresh.');
    } catch (error) {
      if (token === this.token) this.message(error.name === 'QuotaExceededError' ? 'This browser has no room for that song. You can still use it for this visit; try a smaller recording to save.' : `Could not save: ${error.message} You can still use this song for this visit.`, true);
    } finally { if (token === this.token) { this.busy = false; this.render(); } }
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
    try {
      const songs = await this.library.list(this.showArchived);
      if (token !== this.libraryToken) return;
      this.el('library-list').innerHTML = songs.length ? songs.map(song => `<article class="library-song"><div><h3>${escapeHtml(song.title)}</h3><p>${song.notes} hits · ${formatDuration(song.duration)} · ${(song.bytes / 1024 / 1024).toFixed(1)} MB</p><small>${escapeHtml(song.audioName || 'MIDI only · no backing audio')}</small></div><div class="library-song-actions">${this.showArchived ? '' : `<button class="button secondary" data-action="load" data-song="${escapeHtml(song.id)}" aria-label="Load ${escapeHtml(song.title)}">Load song →</button>`}<button class="text-button" data-action="archive" data-song="${escapeHtml(song.id)}" aria-label="${this.showArchived ? 'Restore' : 'Archive'} ${escapeHtml(song.title)}">${this.showArchived ? 'Restore' : 'Archive'}</button></div></article>`).join('') : `<p class="library-empty">${this.showArchived ? 'No archived songs.' : 'Your next practice is one save away. Import a MIDI file, add audio if you have it, then choose Save to library.'}</p>`;
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
      Object.assign(draft, { midiBytes: savedSong.midiBytes, audioBytes: savedSong.audioBytes, audioName: savedSong.audioName, selected: savedSong.selected, mapping: savedSong.mapping, offset: savedSong.offset, volume: savedSong.volume, libraryId: id });
      if (draft.audioBytes) draft.buffer = await this.audio.decodeBacking(draft.audioBytes.slice(0));
      if (token !== this.libraryToken) return;
      // Opening setup lets the student review the part and alignment before a run.
      this.el('library-dialog').close();
      this.token++; this.busy = false; this.draft = draft;
      this.el('midi-file').value = ''; this.el('audio-file').value = '';
      this.message('Saved song ready, including its drum assignments and backing setup.');
      this.render(); this.dialog.showModal();
    } catch (error) {
      if (token === this.libraryToken) {
        this.el('library-status').textContent = `Could not open: ${error.message}`;
        this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    } finally { if (token === this.libraryToken) { this.libraryBusy = false; this.el('show-archived').disabled = false; } }
  }
  async archiveSong(id, archived) {
    this.libraryBusy = true;
    const token = ++this.libraryToken;
    this.el('show-archived').disabled = true;
    this.el('library-list').querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      await this.library.archive(id, archived);
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
      const chart = makeMidiChart(this.draft.song, this.draft.selected, this.draft.mapping);
      if (!Number.isFinite(this.draft.offset) || Math.abs(this.draft.offset) > 300) throw new Error('Choose an audio offset between −300 and +300 seconds.');
      if (this.draft.buffer) backingSchedule(0, this.draft.offset, this.draft.buffer.duration);
      this.applied = this.copyDraft(this.draft);
      try {
        const existing = JSON.parse(localStorage.getItem('groove-lab-song-preferences') || '{}');
        const profiles = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
        delete profiles[this.draft.song.fingerprint];
        profiles[this.draft.song.fingerprint] = { selected: this.draft.selected, mapping: this.draft.mapping, offset: this.draft.offset, volume: this.draft.volume };
        localStorage.setItem('groove-lab-song-preferences', JSON.stringify(Object.fromEntries(Object.entries(profiles).slice(-10))));
      } catch { /* Song files remain usable when browser storage is unavailable. */ }
      this.onApply({ chart, song: this.draft.song, backing: this.draft.buffer ? { buffer: this.draft.buffer, name: this.draft.audioName, offset: this.draft.offset, volume: this.draft.volume } : null });
      this.dialog.close();
    } catch (error) { this.message(error.message, true); }
  }
}
