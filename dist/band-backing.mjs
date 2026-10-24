import { validateTimingMap, timingFunctions } from './timing-map.mjs';
import { AudioSync } from './audio-sync.mjs';
import { makeMidiChart, midiTimeGrid } from './midi.mjs';
import { vocalMelody } from './vocal-guide.mjs';
import { validateAlignment, midiPositionTime } from './sync.mjs';
import { validateAudioRange } from './backing-range.mjs';
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
    q('b-timing-map-file').onchange=()=>importer.attempt(()=>this.loadTimingMap());
    q('b-timing-map-save').onclick=()=>importer.attempt(()=>this.saveTimingMap());
    q('b-timing-map-anchor').onclick=()=>importer.attempt(()=>this.addTimingAnchor());
    q('b-timing-map-clear').onclick=()=>importer.attempt(()=>this.clearTimingMap());
    q('b-sync-reference').onchange = () => { this.cancel(); this.render(); };
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
    for(const id of ['b-audio-start','b-audio-end'])q(id).addEventListener('change',()=>this.range());
    for(const [id,field] of [['b-trim-start','b-audio-start'],['b-trim-end','b-audio-end']])q(id).onclick=()=>{q(field).value=q('b-sync-audio').value;this.range();};
    q('b-trim-reset').onclick=()=>{q('b-audio-start').value=0;q('b-audio-end').value='';this.range();};
    q('b-trim-align').onclick=()=>{
      try {if(!this.range())return;const draft=this.importer.draft;const midi=midiPositionTime(this.reference(),Number(q('b-sync-bar').value),Number(q('b-sync-beat').value));this.sync.set({offset:timingFunctions(draft).forward(midi)-(draft.audioStart||0),timeScale:draft.timeScale||1});}
      catch(error){q('b-range-state').textContent=error.message;}
    };
  }
  async loadTimingMap() {
    const draft=this.importer.draft,file=this.q('b-timing-map-file').files[0];if(!file)return;
    if(!draft?.buffer)throw new Error('Load the matching backing recording first.');
    if(file.size>512000)throw new Error('Choose a timing map smaller than 512 KB.');
    const token=this.importer.token,input=JSON.parse(await file.text());if(token!==this.importer.token)return;
    if(input.format!=='bandapp-timing-map'||input.fingerprint!==draft.song.fingerprint||input.audioName!==draft.audioName||input.audioBytes!==draft.audioBytes.byteLength)throw new Error('This timing map must match the exact MIDI and selected backing file.');
    const timingMap=validateTimingMap(input.timingMap);if(timingMap.points.at(-1)[0]<draft.song.duration-.001)throw new Error('The timing map must cover the entire MIDI arrangement.');
    this.cancel();Object.assign(draft,{timingMap,offset:-timingMap.points[0][1],timeScale:1});this.writeControls();this.reset();
    this.q('b-import-state').textContent='Timing map loaded for this backing. Preview several sections, then publish to save.';
  }
  saveTimingMap() {
    const draft=this.importer.draft;if(!draft?.timingMap)throw new Error('This backing uses simple alignment.');
    const input={format:'bandapp-timing-map',version:1,fingerprint:draft.song.fingerprint,audioName:draft.audioName,audioBytes:draft.audioBytes.byteLength,timingMap:{...draft.timingMap,points:draft.timingMap.points.map(([m,a])=>[m,a-draft.timingMap.points[0][1]-draft.offset])}};
    this.importer.practice.download('backing-timing-map.json',JSON.stringify(input,null,2),'application/json');
  }
  addTimingAnchor() {
    const draft=this.importer.draft;if(!draft?.buffer)throw new Error('Load a recording first.');this.readControls();
    const midi=midiPositionTime(this.reference(),Number(this.q('b-sync-bar').value),Number(this.q('b-sync-beat').value)),audio=Number(this.q('b-sync-audio').value);
    if(!Number.isFinite(audio)||audio<0||audio>=draft.buffer.duration)throw new Error('Choose the matching time inside the recording.');
    const origin=draft.timingMap?.points[0][1] || 0;
    const points=draft.timingMap ? draft.timingMap.points.map(([m,a])=>[m,a-origin-draft.offset]) : [[0,-draft.offset],[draft.song.duration,draft.song.duration*(draft.timeScale??1)-draft.offset]];
    const match=points.findIndex(point=>Math.abs(point[0]-midi)<.02);if(match>=0)points[match]=[midi,audio];else points.push([midi,audio]);points.sort((a,b)=>a[0]-b[0]);
    const timingMap=validateTimingMap({version:1,source:'Teacher refined timing map',points});this.cancel();Object.assign(draft,{timingMap,offset:-points[0][1],timeScale:1});this.writeControls();this.render();this.q('b-import-state').textContent='Anchor saved in this backing draft. Preview and publish to keep it.';
  }
  clearTimingMap() {
    const draft=this.importer.draft;if(!draft?.timingMap)return;
    const points=draft.timingMap.points,scale=(points.at(-1)[1]-points[0][1])/(points.at(-1)[0]-points[0][0]);validateAlignment(draft.offset,scale);
    this.cancel();draft.timingMap=null;draft.timeScale=scale;this.writeControls();this.reset();
  }
  range() {
    if(!this.importer.draft?.buffer)return false; this.cancel();
    try {
      const range=validateAudioRange({audioStart:Number(this.q('b-audio-start').value || 0),audioEnd:this.q('b-audio-end').value===''?null:Number(this.q('b-audio-end').value)},this.importer.draft.buffer.duration);
      Object.assign(this.importer.draft,{audioStart:range.audioStart ?? 0,audioEnd:range.audioEnd ?? null});this.render();return true;
    } catch(error){this.q('b-range-state').textContent=error.message;return false;}
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
    q('b-timing-map-state').textContent=draft?.timingMap ? draft.timingMap.points.length+' timing anchors · '+draft.timingMap.source+'. Follows this recording’s tempo changes.' : 'Simple alignment: one offset and overall speed. Other backing versions are independent.';
    q('b-backing-current').textContent = draft?.buffer ? draft.audioName + ' · ' + Math.floor(draft.buffer.duration/60) + ':' + String(Math.floor(draft.buffer.duration%60)).padStart(2,'0') : 'No backing track loaded. Choose an audio file to preview and align it.';
    const audioLength=draft?.buffer?.duration, midiLength=draft ? timingFunctions(draft).forward(draft.song.duration) : 0;
    const different=audioLength && Math.abs(audioLength-midiLength)>Math.max(8,midiLength*.08);
    q('b-backing-length-state').textContent = audioLength ? 'Recording '+duration(audioLength)+' · MIDI '+duration(midiLength)+(different?'. Check that both versions contain the same sections. Offset and speed cannot fix added or missing bars.':'. Check the beginning and a later section before publishing.') : '';
    q('b-backing-volume-value').textContent = q('b-import-volume').value + '%';
    q('b-backing-lyrics-state').textContent = this.importer.currentBacking()?.lyricsText!==undefined ? 'This backing has its own imported word timing. Other versions retain the base lyrics.' : !q('b-lyrics-text').value?.trim() ? '' : q('b-lyrics-clock').value === 'recording' ? 'These lyrics follow recording timestamps. Review their timing when replacing the backing track.' : 'The lyrics follow MIDI time and move with this alignment.';
    q('b-range-state').textContent=draft?.buffer ? 'Keep '+(draft.audioStart || 0).toFixed(3)+'–'+(draft.audioEnd ?? audioLength).toFixed(3)+' s. Cuts are reversible; the original recording and alignment are preserved.' : 'Load a recording to choose its start and end.';
    for(const id of ['b-audio-start','b-audio-end'])if(audioLength)q(id).max=String(audioLength);
  }
  render() {
    this.references(); this.sync.render(); this.caption();
    this.importer.renderVocalState();
    const busy = this.owner.busy;
    for (const id of ['b-midi-file','b-audio-file','b-clear-audio','b-import-offset','b-import-speed','b-import-apply','b-publish','b-setup-file','b-setup-save','b-sync-reference','b-timing-map-file','b-timing-map-save','b-timing-map-anchor','b-timing-map-clear','b-vocal-notes-file']) this.q(id).disabled = busy || id!=='b-midi-file'&&!this.importer.draft || ['b-import-apply','b-publish','b-setup-save'].includes(id)&&!!this.importer.draft?.audioFailed;
    this.q('b-import-speed').disabled=busy||!this.importer.draft||!!this.importer.draft.timingMap;
    for(const id of ['b-timing-map-save','b-timing-map-clear'])this.q(id).disabled=busy||!this.importer.draft?.timingMap;
    this.q('b-timing-map-anchor').disabled=busy||!this.importer.draft?.buffer;
    this.q('b-import-volume').disabled = !!this.importer.publishing || !this.importer.draft;
    for(const id of ['b-audio-start','b-audio-end','b-trim-start','b-trim-end','b-trim-reset','b-trim-align'])this.q(id).disabled=busy||!this.importer.draft?.buffer;
    for (const select of this.q('b-import-tracks').querySelectorAll('select')) select.disabled = busy;
  }
}
