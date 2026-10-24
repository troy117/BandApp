import { AudioSync } from './audio-sync.mjs';
import { makeMidiChart, midiTimeGrid } from './midi.mjs';
import { vocalMelody } from './vocal-guide.mjs';
import { validateAlignment } from './sync.mjs';
import { BAND_INSTRUMENTS } from './follow-along.mjs';

export function backingReferences(song, assignments, mapping = {}) {
  return Object.entries(BAND_INSTRUMENTS).flatMap(([instrument, name]) => {
    const selected = assignments.filter(item => item.instrument === instrument).map(item => item.id);
    if (!selected.length) return [];
    let chart;
    if (instrument === 'drums') {
      try { chart = makeMidiChart(song, selected, mapping); } catch { return []; }
    } else chart = { ...midiTimeGrid(song), kind: instrument, notes: vocalMelody(song, selected) };
    return chart.notes.length ? [{ id: instrument, name, chart }] : [];
  });
}

export class BandBacking {
  constructor(importer) {
    this.importer = importer; this.q = importer.q; this.analysisBusy = false;
    const self = this, q = this.q;
    this.owner = {
      token: 0,
      get draft() { return importer.draft; },
      get busy() { return self.analysisBusy || !!importer.draft?.pendingAudio || !!importer.publishing; },
      set busy(value) { self.analysisBusy = value; },
      audio: importer.practice.audio,
      el: id => q(id === 'midi-speed' ? 'b-import-speed' : 'b-' + id),
      dialog: { get open() { return !q('b-import-panel').hidden; }, addEventListener: (...args) => q('b-import-panel').addEventListener(...args) },
      syncChart: () => self.reference(),
      render: () => { self.writeControls(); self.render(); },
      message: text => { q('b-import-state').textContent = text; },
      beforePreview: () => { importer.timing.pause(); importer.practice.stop('Previewing the backing track.'); },
      playSyncNote: (note, at) => {
        if (note.drum) importer.practice.audio.play(note.drum, at, (note.velocity || .7) * .65);
        else {
          const id = 'backing-preview-' + note.id;
          importer.practice.piano.on(id, note.pitch, (note.velocity || .7) * .65, at);
          importer.practice.piano.off(id, at + Math.min(.4, (note.duration || .2) * (importer.draft.timeScale || 1)));
        }
      },
    };
    this.sync = new AudioSync(this.owner);
    q('b-sync-reference').onchange = () => { this.cancel(); this.sync.reset(); this.render(); };
    q('b-import-tracks').addEventListener('change', () => this.reset());
    for (const id of ['b-import-offset','b-import-speed']) q(id).addEventListener('input', () => {
      this.cancel();
      try { this.readControls(); this.render(); } catch (error) { this.sync.status(error.message); }
    });
    q('b-import-volume').addEventListener('input', () => {
      if (importer.draft) importer.draft.volume = Number(q('b-import-volume').value) / 100;
      importer.practice.audio.setBackingVolume?.(importer.draft?.volume ?? .65); this.caption();
    });
    q('b-lyrics-clock').addEventListener('change', () => this.caption());
  }
  cancel() { this.owner.token++; this.analysisBusy = false; this.sync.stop(); }
  stop() { this.sync.stop(); }
  readControls() {
    const draft = this.importer.draft; if (!draft) return;
    const alignment = validateAlignment(Number(this.q('b-import-offset').value), 100 / Number(this.q('b-import-speed').value));
    Object.assign(draft, alignment, {volume:Number(this.q('b-import-volume').value)/100});
  }
  writeControls() {
    const draft = this.importer.draft; if (!draft) return;
    this.q('b-import-offset').value = draft.offset; this.q('b-import-speed').value = 100 / draft.timeScale;
  }
  references() {
    const draft = this.importer.draft;
    if (!draft) { this.q('b-sync-reference').innerHTML=''; this.referenceKey=null; this.charts=[]; return []; }
    const assignments = [...this.q('b-import-tracks').querySelectorAll('[data-band-track]')].map(select => ({id:select.dataset.bandTrack,instrument:select.value}));
    const key = JSON.stringify([draft.song.fingerprint, assignments, draft.mapping]);
    if (key !== this.referenceKey) {
      this.referenceKey = key; this.charts = backingReferences(draft.song, assignments, draft.mapping);
      const picker = this.q('b-sync-reference'), previous = picker.value;
      picker.innerHTML = this.charts.map(part => '<option value="'+part.id+'">'+part.name+' · '+part.chart.notes.length+' notes</option>').join('');
      picker.value = this.charts.some(part => part.id === previous) ? previous : this.charts.find(part => part.id === 'drums')?.id || this.charts[0]?.id || '';
    }
    return this.charts;
  }
  reference() {
    const charts = this.references(), part = charts.find(part => part.id === this.q('b-sync-reference').value);
    if (!part) throw new Error('Assign a MIDI instrument part before matching its backing track.');
    return part.chart;
  }
  reset() {
    this.cancel(); this.referenceKey = null;
    this.readControls(); this.sync.reset(); this.render();
  }
  caption() {
    const draft = this.importer.draft, q = this.q;
    const duration = seconds => Math.floor(seconds/60) + ':' + String(Math.floor(seconds%60)).padStart(2,'0');
    q('b-backing-current').textContent = draft?.buffer ? draft.audioName + ' · ' + Math.floor(draft.buffer.duration/60) + ':' + String(Math.floor(draft.buffer.duration%60)).padStart(2,'0') : 'No backing track loaded. Choose an audio file to preview and align it.';
    const audioLength=draft?.buffer?.duration, midiLength=draft ? draft.song.duration * (draft.timeScale || 1) : 0;
    const different=audioLength && Math.abs(audioLength-midiLength)>Math.max(8,midiLength*.08);
    q('b-backing-length-state').textContent = audioLength ? 'Recording '+duration(audioLength)+' · MIDI '+duration(midiLength)+(different?'. Check that both versions contain the same sections. Offset and speed cannot fix added or missing bars.':'. Check the beginning and a later section before publishing.') : '';
    q('b-backing-volume-value').textContent = q('b-import-volume').value + '%';
    q('b-backing-lyrics-state').textContent = !q('b-lyrics-text').value?.trim() ? '' : q('b-lyrics-clock').value === 'recording' ? 'These lyrics follow recording timestamps. Review their timing when replacing the backing track.' : 'The lyrics follow MIDI time and move with this alignment.';
  }
  render() {
    this.references(); this.sync.render(); this.caption();
    const busy = this.owner.busy;
    for (const id of ['b-midi-file','b-audio-file','b-clear-audio','b-import-offset','b-import-speed','b-import-apply','b-publish','b-setup-file','b-setup-save','b-sync-reference']) this.q(id).disabled = busy || id!=='b-midi-file'&&!this.importer.draft || ['b-import-apply','b-publish','b-setup-save'].includes(id)&&!!this.importer.draft?.audioFailed;
    this.q('b-import-volume').disabled = !!this.importer.publishing || !this.importer.draft;
    for (const select of this.q('b-import-tracks').querySelectorAll('select')) select.disabled = busy;
  }
}
