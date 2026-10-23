import { vocalTarget, drawVocalStaff } from './vocal-guide.mjs';
import { drawDrumHighway } from './drum-highway.mjs';
import { FrettedFullScore } from './fretted-score.mjs';
import { makeRunReport, stoppedJudge } from './run-report.mjs';
import { createPracticeChart, backingSegments } from './practice.mjs';
import { orderedDrums } from './drum-lanes.mjs';
import { DRUMS, Judge, keyLabel } from './engine.mjs';
import { DrumAudio } from './audio.mjs';
import { MidiDrumInput } from './midi-input.mjs';
import { pitchName, KEYBOARD_PITCHES, DEFAULT_PIANO_BINDINGS, pianoBindings, bindPianoKey, pitchedMidiMessage, PitchJudge } from './instruments.mjs';
import { DUETS, builtinArrangement, partSummary, partCsv } from './arrangements.mjs';
import { PianoVoices } from './piano-audio.mjs';
import { bandMarkup } from './band-markup.mjs';
import { BandRooms } from './band-rooms.mjs';
import { BandImport } from './band-import.mjs';
import { createNotation, drawSheet } from './notation.mjs';
import { FullScoreView } from './full-score.mjs';
import { escapeHtml } from './song-import.mjs';
import { backingSchedule } from './midi.mjs';
import { followInstrument, FollowCursor } from './follow-along.mjs';
import { drawFretted } from './follow-view.mjs';
import { KaraokeLyrics } from './karaoke-view.mjs';
import { SingingPractice } from './singing-practice.mjs';

export class BandPractice {
  constructor({ school, beforeEnter, getDrumBindings, getDrumOrder, onReport, onAttempt, openDrumControls }) {
    Object.assign(this, { school, beforeEnter, getDrumBindings, getDrumOrder, onReport, onAttempt, openDrumControls });
    this.q = id => document.getElementById(id); this.mode = 'drums'; this.session = null; this.token = 0; this.loadToken = 0; this.held = new Map(); this.capture = null; this.pendingResult = null;
    let preferences = {}; try { preferences = JSON.parse(localStorage.getItem('groove-piano-v1') || '{}') || {}; } catch {}
    this.bindings = pianoBindings(preferences.bindings); this.octave = [-24, -12, 0, 12, 24].includes(preferences.octave) ? preferences.octave : 0;
    this.offset = Number.isFinite(preferences.offset) && Math.abs(preferences.offset) <= 200 ? preferences.offset : 0;
    this.channel = preferences.channel === 'all' || Number.isInteger(Number(preferences.channel)) && Number(preferences.channel) >= 1 && Number(preferences.channel) <= 16 ? preferences.channel : 'all';
    this.audio = new DrumAudio(); this.piano = new PianoVoices(this.audio);
    const nav = document.createElement('nav'); nav.className = 'instrument-nav'; document.body.classList.add('has-instrument-menu'); nav.setAttribute('aria-label', 'Practice area');
    nav.innerHTML = '<button id="instrument-menu-toggle" aria-expanded="true" aria-label="Collapse instrument menu"><span aria-hidden="true">☰</span><span class="instrument-label">Instruments</span></button><div class="instrument-choices">'+[['drums','Drums','Dr'],['keyboard','Keyboard','♬'],['guitar','Guitar','Gt'],['bass','Bass','Bs'],['vocals','Vocals','♪'],['jam','Jam session','♫']].map(([id,label,icon])=>'<button data-band-mode="'+id+'" aria-label="'+label+'" title="'+label+'" aria-pressed="'+(id==='drums')+'"><span class="instrument-icon" aria-hidden="true">'+icon+'</span><span class="instrument-label">'+label+'</span></button>').join('')+'</div>';
    const toggle=nav.querySelector('#instrument-menu-toggle');
    const collapseMenu=collapsed=>{document.body.classList.toggle('instrument-menu-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',(collapsed?'Expand':'Collapse')+' instrument menu');window.dispatchEvent(new Event('resize'));};
    let menuCollapsed=window.matchMedia('(max-width: 800px)').matches;
    collapseMenu(menuCollapsed);toggle.onclick=()=>collapseMenu(menuCollapsed=!menuCollapsed);
    this.q('workspace').before(nav);
    const root = document.createElement('section'); root.id = 'band-workspace'; root.hidden = true; root.innerHTML = bandMarkup(); nav.after(root);
    for (const button of nav.querySelectorAll('[data-band-mode]')) button.onclick = () => this.setMode(button.dataset.bandMode);
    this.catalog = DUETS.map(song => { const arrangement = builtinArrangement(song.id); return { ...arrangement, parts: arrangement.parts.map(({ id, name, instrument }) => ({ id, name, instrument })) }; });
    this.arrangement = builtinArrangement(); this.part = this.arrangement.parts.find(part => part.instrument === 'keyboard');
    this.rooms = new BandRooms(this); this.importer = new BandImport(this);
    this.midi = new MidiDrumInput({ instrument: 'keyboard', parseMessage: pitchedMidiMessage, preferred: preferences.device || {}, onNote: note => this.midiNote(note), onState: state => this.renderMidi(state), onLost: () => { this.clearHeld(); if (this.active && !this.rooms.teacher && this.part.instrument === 'keyboard') { this.stop('Keyboard disconnected. Reconnect or use computer keys, then prepare a fresh run.',true,true); this.rooms.unready('Keyboard disconnected.'); } } });
    this.fullScore = new FullScoreView(this.q('b-full-scroll'), this.q('b-full-page'), this.q('b-full-canvas'));
    this.frettedScore=new FrettedFullScore(this.q('b-full-scroll'),this.q('b-full-page'),this.q('b-full-canvas'));
    const q = this.q;
    this.karaoke = new KaraokeLyrics(q);
    this.singing = new SingingPractice(this);
    q('b-publish').hidden = !school.staff;
    q('b-octave').value = this.octave; q('b-offset').value = this.offset; q('b-channel').value = this.channel; q('b-sound').checked = preferences.sound !== false;
    q('b-song').onchange = () => this.attempt(() => this.loadChoice(q('b-song').value));
    q('b-part').onchange = () => this.selectPart(q('b-part').value);
    q('b-catalog-refresh').onclick = () => this.attempt(() => this.refreshCatalog());
    q('b-connect').onclick = () => { this.rooms.unready('Input changed.'); this.midi.connect(); };
    q('b-disconnect').onclick = () => { this.stop('MIDI keyboard disconnected.'); this.rooms.unready('Input changed.'); this.midi.disconnect(); this.clearHeld(); };
    q('b-device').onchange = () => { this.stop('MIDI input changed.'); this.rooms.unready('Input changed.'); this.midi.select(q('b-device').value); };
    q('b-kit').onclick = () => { this.stop('Drum controls opened.'); this.rooms.unready('Drum controls opened.'); openDrumControls(); };
    for (const id of ['b-channel', 'b-offset', 'b-octave']) q(id).onchange = () => {
      this.stop('Input settings changed.'); this.rooms.unready('Input settings changed.');
      this.channel = q('b-channel').value; this.offset = Math.max(-200, Math.min(200, Number(q('b-offset').value) || 0)); this.octave = Number(q('b-octave').value);
      q('b-offset').value = this.offset; this.persist(); this.renderKeys();
    };
    q('b-sound').onchange = () => { this.clearHeld(); this.persist(); };
    q('b-vocal-guide-enabled').onchange = () => { if (!q('b-vocal-guide-enabled').checked) this.piano.clear(); };
    q('b-play').onclick = () => this.attempt(() => this.play());
    q('b-full-play').onclick = () => this.attempt(() => this.play());
    q('b-listen').onclick = () => this.attempt(() => this.play(true));
    q('b-view').onchange = () => this.renderView();
    q('b-volume').oninput = () => { const volume = Number(q('b-volume').value) / 100; if (this.backing) this.backing.volume = volume; this.audio.setBackingVolume(volume); };
    q('b-reset-keys').onclick = () => { this.bindings = { ...DEFAULT_PIANO_BINDINGS }; this.capture = null; this.persist(); this.renderKeys(); };
    q('b-bindings').onclick = event => { const button = event.target.closest('[data-pitch-bind]'); if (button) { this.stop('Controls opened.'); this.rooms.unready('Controls changed.'); this.capture = Number(button.dataset.pitchBind); this.renderKeys(); this.message('Press a new key for ' + pitchName(this.capture + this.octave) + '. Esc cancels.'); } };
    q('b-fullscreen').onclick = () => this.expand(); q('b-full-exit').onclick = () => this.collapse();
    document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement !== q('b-stage') && this.nativeFull) { this.nativeFull = false; this.finishCollapse(); } });
    document.addEventListener('keydown', event => this.keyDown(event), true); document.addEventListener('keyup', event => this.keyUp(event), true);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.active) { this.stop('Tab hidden. Prepare a fresh take when you return.',true,true); this.rooms.unready('Tab hidden.'); this.clearHeld(); } });
    window.addEventListener('blur', () => { this.clearHeld(); if (this.active && this.session && !this.session.teacher && this.part.instrument !== 'vocals') this.stop('Window lost focus. Prepare a fresh take when you return.',true,true); });
    q('b-csv').onclick = () => { if (this.lastReport) this.download('groove-lab-' + this.lastReport.part.instrument + '-timing.csv', partCsv(this.lastReport.judge), 'text/csv'); };
    q('b-retry-save').onclick = () => this.saveResult();
    q('b-open-report').onclick=()=>{if(this.lastReport?.detail)this.onReport?.(this.lastReport.runRecord,this.lastReport.detail);};
    this.loopOptions={enabled:false,startBar:1,endBar:4,repeats:4,focus:'all'};
    for(const id of ['b-loop-enabled','b-loop-from','b-loop-to','b-loop-repeats'])q(id).onchange=()=>{
      const options={enabled:q('b-loop-enabled').checked,startBar:Number(q('b-loop-from').value),endBar:Number(q('b-loop-to').value),repeats:Number(q('b-loop-repeats').value),focus:'all'};
      try{if(options.enabled)createPracticeChart(this.part.chart,options);this.loopOptions=options;this.loopChart=null;q('b-loop-state').textContent=options.enabled?'Bars '+options.startBar+'–'+options.endBar+' · '+options.repeats+' passes':'Whole song';}catch(error){q('b-loop-state').textContent=error.message;q('b-loop-enabled').checked=false;this.loopOptions.enabled=false;this.loopChart=null;}
    };
    this.renderCatalog(); this.renderPart(); this.renderMidi(this.midi.snapshot());
    this.timer = setInterval(() => this.tick(), 25); requestAnimationFrame(() => this.frame());
    window.addEventListener('band-load-school', event => { const instrument=event.detail.instrument||(['guitar','bass','vocals'].includes(this.mode)?this.mode:'keyboard');this.setMode(instrument); this.attempt(() => this.loadChoice('school:' + event.detail.id, undefined, instrument)); });
    window.addEventListener('band-edit-school', event => { this.setMode('keyboard'); this.importer.attempt(() => this.importer.editSchoolSong(event.detail.id)); });
  }
  get active() { return this.mode !== 'drums'; }
  message(text) { this.q('b-message').textContent = text; }
  async attempt(action) { try { await action(); } catch (error) { this.message(error.message || 'Try again.'); } }
  persist() {
    try { localStorage.setItem('groove-piano-v1', JSON.stringify({ bindings: this.bindings, octave: this.octave, offset: this.offset, channel: this.channel, sound: this.q('b-sound').checked, device: this.midi?.preferred || {} })); }
    catch { this.message('Device storage is unavailable. Controls last for this visit.'); }
  }
  setMode(mode) {
    if (this.mode !== mode) { this.singing.microphone.stop(); this.importer.timing.pause(); this.stop('Practice area changed.'); this.rooms.unready('Practice area changed.'); this.beforeEnter(); this.clearHeld(); this.collapse(); }
    this.mode = mode; document.body.classList.toggle('band-active', this.active); this.q('band-workspace').hidden = !this.active;
    document.querySelector('main h1').textContent = mode === 'drums' ? 'Drum practice' : mode === 'keyboard' ? 'Keyboard practice' : mode === 'jam' ? 'Jam session' : mode === 'vocals' ? 'Singing practice' : mode[0].toUpperCase()+mode.slice(1)+' · follow along';
    for (const button of document.querySelectorAll('[data-band-mode]')) button.setAttribute('aria-pressed', String(button.dataset.bandMode === mode));
    this.q('b-room-panel').hidden = mode !== 'jam';
    this.q('b-title').textContent = mode === 'jam' ? 'Play together. Follow your part.' : followInstrument(mode) ? 'Follow the song. Play your part.' : 'A melody, one note at a time.';
    this.q('b-description').textContent = mode === 'jam' ? 'One teacher starts the count-in. Each student follows their own part.' : mode === 'vocals' ? 'Sing with the lyrics. Turn on your microphone for optional live pitch guidance.' : followInstrument(mode) ? 'Follow the shared music and timing. Guitar and bass do not require input or produce a performance score.' : 'Use a MIDI keyboard or your computer keys. Middle C is C4 (MIDI 60).';
    this.q('open-drumkit').hidden = this.active; this.q('open-settings').hidden = this.active;
    if (mode === 'jam') this.attempt(() => this.rooms.refresh());
    if (mode !== 'jam' && this.rooms.room) this.rooms.leave();
    if (followInstrument(mode)) { if(!this.arrangement.parts.some(part=>part.instrument===mode))this.useArrangement(builtinArrangement('band-first'),mode);else this.selectPart(this.arrangement.parts.find(part=>part.instrument===mode).id); }
    if(mode==='keyboard' && followInstrument(this.part.instrument)) { const part=this.arrangement.parts.find(part=>part.instrument==='keyboard');if(part)this.selectPart(part.id);else this.useArrangement(builtinArrangement(),'keyboard'); }
    this.renderKeys();
    document.body.classList.toggle('singing-mode', this.active && this.part.instrument === 'vocals');
  }
  identity() {
    this.stop('School account changed.'); this.rooms.leave(); this.lastReport = null; this.pendingResult = null; this.loadToken++; this.importer.reset();
    this.rooms.resetSeats();
    this.q('b-report').hidden = true; this.q('b-performers').textContent = ''; this.q('b-rooms').textContent = ''; this.q('b-takes').textContent = ''; this.q('b-student-a').textContent = ''; this.q('b-student-b').textContent = ''; this.q('b-account').textContent = this.school.user ? this.school.user.name : 'Guest practice';
    for (const id of ['b-report-summary', 'b-report-notes', 'b-save-state', 'b-room-title', 'b-sync']) this.q(id).textContent = '';
    this.q('b-feedback').textContent = 'Listen to the pattern, then try it yourself.';
    this.q('b-publish').hidden = !this.school.staff;this.q('b-open-import').hidden=this.school.user?.role==='student';
    this.useArrangement(builtinArrangement()); this.attempt(() => this.refreshCatalog()); if (this.mode === 'jam') this.attempt(() => this.rooms.refresh());
  }
  async refreshCatalog() {
    this.catalog = DUETS.map(song => { const arr = builtinArrangement(song.id); return { ...arr, parts: arr.parts.map(({ id, instrument, name }) => ({ id, instrument, name })) }; });
    if (this.school.user && !this.school.user.mustChangePassword) {
      const { songs } = await this.school.request('/band/catalog'); this.catalog = songs;
    }
    const current = this.arrangement.sourceKind + ':' + this.arrangement.id;
    this.renderCatalog(); if (this.catalog.some(song => song.sourceKind + ':' + song.id === current)) this.q('b-song').value = current;
    this.rooms.catalogChoices();
  }
  renderCatalog() {
    this.q('b-song').innerHTML = this.catalog.map(song => '<option value="' + song.sourceKind + ':' + song.id + '">' + escapeHtml(song.title) + (song.sourceKind === 'school' ? ' · School' : '') + '</option>').join('');
  }
  async loadChoice(value, revision, instrument) {
    if (this.rooms.room) throw new Error('Leave the session before changing songs.');
    this.stop(); const token = ++this.loadToken, [kind, id] = value.split(':');
    let arrangement;
    if (kind === 'duet') arrangement = builtinArrangement(id);
    else {
      const song = this.catalog.find(song => song.id === id);
      const response = await this.school.request('/band/arrangements/school/' + id + '?revision=' + encodeURIComponent(revision || song?.revisionId || '')); arrangement = response.arrangement;
    }
    if (token !== this.loadToken) return;
    this.useArrangement(arrangement, instrument); this.message('Song ready. Listen first to check the selected part.');
  }
  useArrangement(arrangement, instrument = this.part?.instrument) {
    this.loadToken++; this.stop(); this.arrangement = arrangement; this.backing = arrangement.backing || null; this.startedTake = null; this.teacherGuide = null;
    const volume = Math.round((this.backing?.volume ?? arrangement.audio?.volume ?? 0.65) * 100);
    this.q('b-volume').value = volume; this.q('b-speaker-volume').value = volume;
    const part = arrangement.parts.find(part => part.instrument === instrument) || arrangement.parts.find(part => part.instrument === 'keyboard') || arrangement.parts[0];
    this.part = part; this.renderPart();
    const key = arrangement.sourceKind + ':' + arrangement.id;
    if ([...this.q('b-song').options].some(option => option.value === key)) this.q('b-song').value = key;
  }
  selectPart(id) { if (this.rooms.room && this.session) return; this.stop(); this.part = this.arrangement.parts.find(part => part.id === id) || this.arrangement.parts[0]; this.renderPart(); }
  renderPart() {
    const q = this.q, keys = this.part.instrument === 'keyboard', follow = followInstrument(this.part.instrument), strings = ['guitar','bass'].includes(this.part.instrument);
    this.singing?.reset();
    q('b-report').hidden = true;
    q('b-vocal-melody-panel').hidden = this.part.instrument !== 'vocals' || !this.part.chart.notes.length;
    q('b-vocal-guide-enabled').checked = false;
    this.loopOptions={enabled:false,startBar:1,endBar:Math.min(4,this.part.chart.bars),repeats:4,focus:'all'};this.loopChart=null;
    q('b-loop-enabled').checked=false;q('b-loop-from').value=1;q('b-loop-to').value=this.loopOptions.endBar;q('b-loop-from').max=q('b-loop-to').max=this.part.chart.bars;q('b-loop-state').textContent='Whole song';
    q('b-part').innerHTML = this.arrangement.parts.map(part => '<option value="' + part.id + '">' + escapeHtml(part.name) + '</option>').join(''); q('b-part').value = this.part.id;
    q('b-song-info').textContent = this.arrangement.title + ' · ' + Math.round(this.part.chart.bpm) + ' BPM · ' + this.part.chart.bars + (this.part.chart.bars === 1 ? ' bar' : ' bars') + ' · ' + (this.part.chart.lyrics?.length || this.part.chart.notes.length) + (this.part.instrument==='vocals'?' lyric cues':' notes') + ' · ' + (follow ? 'Follow-along · no score' : keys ? 'Pitch + onset timing' : 'Drum + onset timing');
    q('b-input-controls').hidden=follow;q('b-stats').hidden=follow;q('b-csv').hidden=follow;q('b-open-report').hidden=follow;q('b-follow-help').hidden=!follow;
    q('b-follow-help').textContent=strings?'Suggested frets · standard '+(this.part.instrument==='guitar'?'six-string E A D G B E':'four-string E A D G')+' tuning · frets 0–24. MIDI does not retain original fingering. '+(this.part.chart.unmapped?this.part.chart.unmapped+' notes cannot be placed and are marked with ?; check the tuning or MIDI with your teacher.':'Fret 0 means an open string. Check fingering with your teacher.'):this.part.chart.notes.length ? 'Follow the lyric line and the lead-vocal melody below. Enable your microphone for live pitch guidance, or sing with the lyrics. Sheet music and reference tones are below.' : 'Follow the highlighted lyric line. To add a melody guide, your teacher can assign the lead-vocal MIDI tracks to Vocals in Edit instrument parts.';
    if(follow)q('b-feedback').textContent='Ready to follow your part. Press Play or wait for your teacher’s shared start.';
    q('b-input-controls').open = false;
    q('b-full-title').textContent = this.arrangement.title + ' · ' + this.part.name;
    q('b-input-title').textContent = keys ? 'Your keyboard' : 'Your drums';
    q('b-sound-label').textContent = keys ? 'App instrument sounds' : 'Computer-key sounds (kit sound in drum controls)';
    q('b-midi-state').textContent = keys ? this.midi?.message || 'Computer keys are ready.' : 'Use saved drum keys, or Connect / map drumkit. Kit sound is controlled there.';
    for (const id of ['b-connect', 'b-disconnect', 'b-device-label', 'b-channel-label', 'b-key-controls']) q(id).hidden = !keys;
    q('b-kit').hidden = keys;
    for (const option of q('b-view').options) { const allowed=this.part.instrument==='vocals'?option.value==='lyrics':strings?['highway','tab','full'].includes(option.value):keys?option.value==='highway':['highway','sheet','full'].includes(option.value);option.hidden=!allowed;option.disabled=!allowed; }
    q('b-view').querySelector('option[value=full]').textContent=strings?'Full sheet · tablature':'Full sheet · drums';
    if (keys) q('b-view').value = 'highway';
    if(this.part.instrument==='vocals')q('b-view').value='lyrics';else if([...q('b-view').options].find(option=>option.value===q('b-view').value)?.disabled)q('b-view').value='highway';
    this.notation = null; this.renderKeys(); this.renderView(); this.stats(null); this.lockControls();
  }
  setSection(selection, repeats = 4) {
    if(this.rooms.room)throw new Error('Leave the jam session before individual section practice.');
    this.loopOptions={enabled:true,...selection,repeats,focus:'all'};this.loopChart=createPracticeChart(this.part.chart,this.loopOptions);
    const q=this.q;q('b-loop-enabled').checked=true;q('b-loop-from').value=selection.startBar;q('b-loop-to').value=selection.endBar;q('b-loop-repeats').value=repeats;q('b-loop-controls').open=true;q('b-loop-state').textContent='Bars '+selection.startBar+'–'+selection.endBar+' · '+repeats+' practice passes';this.renderView();q('b-loop-controls').scrollIntoView({behavior:'smooth',block:'center'});
  }
  playChart(){if(this.rooms.room || !this.loopOptions?.enabled || followInstrument(this.part.instrument))return this.part.chart;return this.loopChart||(this.loopChart=createPracticeChart(this.part.chart,this.loopOptions));}
  renderKeys() {
    const q = this.q, keys = this.part.instrument === 'keyboard';
    if(followInstrument(this.part.instrument)){q('b-key-guide').innerHTML='';q('b-key-controls').hidden=true;return;}
    q('b-key-guide').innerHTML = keys ? KEYBOARD_PITCHES.map(base => {
      const pitch = base + this.octave;
      return '<button type="button" data-band-pitch="' + pitch + '" class="' + ([1,3,6,8,10].includes(pitch % 12) ? 'black' : '') + '" aria-label="Play ' + pitchName(pitch) + '"><span>' + pitchName(pitch) + '</span><kbd>' + keyLabel(this.bindings[base]) + '</kbd></button>';
    }).join('') : orderedDrums(this.part.chart, this.getDrumOrder?.()).map(drum => '<button type="button" data-band-drum="' + drum.id + '" style="border-color:' + drum.color + '"><span>' + drum.short + '</span><kbd>' + (this.getDrumBindings()[drum.id]?.map(keyLabel).join('/') || '') + '</kbd></button>').join('');
    for (const button of q('b-key-guide').querySelectorAll('button')) {
      const down = event => { event.preventDefault(); if (event.type === 'pointerdown') button.setPointerCapture?.(event.pointerId); const id = 'pad:' + (button.dataset.bandPitch || button.dataset.bandDrum); this.input(button.dataset.bandDrum || Number(button.dataset.bandPitch), performance.now(), 'pad', 0.7, id); };
      button.onpointerdown = down; button.onpointerup = button.onpointercancel = () => this.release('pad:' + (button.dataset.bandPitch || button.dataset.bandDrum));
      button.onclick = event => { if (event.detail === 0) { down(event); this.release('pad:' + (button.dataset.bandPitch || button.dataset.bandDrum)); } };
    }
    q('b-bindings').innerHTML = KEYBOARD_PITCHES.map(pitch => '<button class="' + (this.capture === pitch ? 'capturing' : '') + '" data-pitch-bind="' + pitch + '">' + pitchName(pitch + this.octave) + ' · ' + (this.capture === pitch ? 'Press a key…' : keyLabel(this.bindings[pitch])) + '</button>').join('');
    q('b-key-controls').hidden = !keys;
  }
  renderMidi(state) {
    const select = this.q('b-device'); select.innerHTML = '<option value="">Choose MIDI input</option>' + state.devices.map(device => '<option value="' + escapeHtml(device.id) + '">' + escapeHtml(device.name) + '</option>').join(''); select.value = state.selectedId || '';
    this.q('b-midi-state').textContent = this.part.instrument === 'keyboard' ? state.message : 'Use your saved drum keys, or open Connect / map drumkit. Pad assignments are shared with solo drums.'; this.persist();
  }
  midiNote(note) {
    if (!this.active || this.part.instrument !== 'keyboard' || (this.channel !== 'all' && Number(this.channel) !== note.channel) || document.querySelector('dialog[open]')) return;
    const id = 'midi:' + note.channel + ':' + note.pitch;
    if (note.type === 'off') this.release(id);
    else { this.input(note.pitch, note.timestamp, 'midi', note.velocity, id); this.q('b-midi-state').textContent = pitchName(note.pitch) + ' · MIDI ' + note.pitch + ' · channel ' + note.channel + ' · ' + Math.round(note.velocity * 127) + ' velocity'; }
  }
  onKitHit(note) { if (this.active && this.part.instrument === 'drums' && !document.querySelector('dialog[open]')) this.input(note.drum, note.timestamp, 'midi', note.velocity, 'kit:' + note.drum, note.sound); }
  keyDown(event) {
    if (!this.active || document.querySelector('dialog[open]')) return;
    if (this.capture !== null) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.code === 'Escape') { this.capture = null; this.renderKeys(); return; }
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
      try { this.bindings = bindPianoKey(this.bindings, this.capture, event.code); this.capture = null; this.persist(); this.renderKeys(); this.message('Computer keys saved on this device.'); } catch (error) { this.message(error.message); } return;
    }
    if (event.code === 'Escape' && this.expanded) { event.preventDefault(); this.collapse(); return; }
    if (event.target.closest?.('input,select,textarea,[contenteditable]') || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.code === 'Escape') { this.stop('Stopped.',true,true); return; }
    if (event.code === 'Enter') { if (!event.target.closest?.('button,a')) { event.preventDefault(); this.attempt(() => this.play()); } return; }
    if(followInstrument(this.part.instrument))return;
    let value;
    if (this.part.instrument === 'keyboard') { const base = Object.keys(this.bindings).find(pitch => this.bindings[pitch] === event.code); if (base !== undefined) value = Number(base) + this.octave; }
    else value = DRUMS.find(drum => this.getDrumBindings()[drum.id]?.includes(event.code))?.id;
    if (value === undefined) return;
    event.preventDefault(); if (this.held.has(event.code)) return;
    this.input(value, event.timeStamp, 'keyboard', 0.75, event.code);
  }
  keyUp(event) { if (this.held.has(event.code)) { event.preventDefault(); this.release(event.code); } }
  input(value, timestamp, source, velocity, id, sound = true) {
    if (this.rooms.teacher || followInstrument(this.part.instrument)) return;
    this.held.set(id, value); this.highlight(value, true);
    const keys = this.part.instrument === 'keyboard', token = this.token;
    if (sound && (source === 'midi' && !keys || this.q('b-sound').checked)) {
      const play = () => { if (token !== this.token || !this.active || !this.held.has(id)) return; if (keys) this.piano.on(id, value, velocity); else this.audio.play(value, undefined, velocity); };
      if (this.audio.context?.state === 'running') play(); else this.audio.ready().then(play).catch(error => this.message(error.message));
    }
    if (!keys) { (this.drumFlashes ||= new Map()).set(value, performance.now()); setTimeout(() => this.release(id), 100); }
    const session = this.session;
    if (!session || session.listen || session.teacher) return;
    const stamp = Number.isFinite(timestamp) && Math.abs(timestamp - performance.now()) < 60000 ? timestamp : performance.now();
    const time = this.audio.audibleTime(stamp) - session.startAt - this.offset / 1000;
    if (time < -0.14 || time > session.judge.chart.duration + 0.14) return;
    const result = session.judge.strike(value, time, source);
    this.q('b-feedback').textContent = result.type === 'extra' ? 'Extra note. Follow the next cue.' : result.type === 'wrong' ? 'Played ' + pitchName(value) + ' · expected ' + pitchName(result.note.pitch) + '.' : Math.abs(result.errorMs) <= 25 ? 'Right on time.' : Math.round(Math.abs(result.errorMs)) + ' ms ' + (result.errorMs < 0 ? 'early' : 'late') + '.';
    this.stats(session.judge);
  }
  highlight(value, held) {
    for (const button of this.q('b-key-guide').querySelectorAll('button')) if (String(button.dataset.bandPitch ?? button.dataset.bandDrum) === String(value)) button.classList.toggle('held', held);
  }
  release(id) { const value = this.held.get(id); this.held.delete(id); this.piano.off(id); if (![...this.held.values()].includes(value)) this.highlight(value, false); }
  clearHeld() { for (const id of [...this.held.keys()]) this.release(id); this.piano.clear(); }
  inputLabel() { return followInstrument(this.part.instrument) ? 'Follow-along · no input required' : this.part.instrument === 'drums' ? 'Computer keys / selected drumkit' : this.midi.status === 'ready' ? this.midi.snapshot().name || 'MIDI keyboard' : 'Computer keys'; }
  async prepareAudio() {
    const generation = this.school.generation, token = this.loadToken;
    await this.audio.ready();
    if (this.observedContext !== this.audio.context) {
      this.observedContext = this.audio.context;
      this.audio.context.addEventListener('statechange', () => { if (this.audio.context.state !== 'running' && (this.session || this.rooms.prepared)) { this.stop('Audio was interrupted. Check sound and prepare a fresh take.',true,true); this.rooms.unready('Audio interrupted.'); } });
    }
    if (this.arrangement.audio && !this.backing && (!this.rooms.room || this.rooms.teacher)) {
      const bytes = await this.school.download(this.arrangement.audio.route), buffer = await this.audio.decodeBacking(bytes);
      if (generation !== this.school.generation || token !== this.loadToken) throw new Error('Song or account changed.');
      this.backing = { ...this.arrangement.audio, buffer, volume: Number(this.q(this.rooms.teacher ? 'b-speaker-volume' : 'b-volume').value) / 100 };
    }
    if (this.backing) backingSchedule(0, this.backing.offset, this.backing.buffer.duration);
  }
  async play(listen = false) {
    if (this.part.instrument === 'vocals' && !this.rooms.room) return this.singing.toggle();
    if (this.session) { this.stop('Stopped.',true,true); return; }
    if (this.rooms.room) { this.message('Use Ready. Your teacher controls session playback.'); return; }
    if (this.school.user?.mustChangePassword) { this.school.openPassword(); return; }
    const token = ++this.token;
    await this.prepareAudio(); if (token !== this.token || !this.active) return;
    try { this.begin(this.audio.context.currentTime + 0.18 + this.part.chart.countInBeats * this.part.chart.countInBeatSeconds, { listen }); }
    catch (error) { this.stop(error.message); throw error; }
  }
  startScheduled(room, clock, teacher) {
    if (this.startedTake === room.takeId) return;
    const countIn = clock.localAt(room.countInAt);
    if (!this.rooms.prepared || this.arrangement.revisionId !== room.arrangement.revisionId || this.arrangement.id !== room.arrangement.id || (this.arrangement.startBar || 1) !== (room.arrangement.startBar || 1) || !clock.status.ready || this.audio.context?.state !== 'running' || performance.now() > countIn - 100 || document.hidden) {
      this.rooms.unready('Audio or timing was not ready for this start.'); this.message('Missed preparation. Wait for a fresh take.'); return;
    }
    this.stop('', false); this.startedTake = room.takeId;
    try { this.begin(this.audio.audibleTime(clock.localAt(room.startAt)), { takeId: room.takeId, teacher, clockOffset: clock.status.offset }); }
    catch (error) { this.stop('Playback could not start: ' + error.message); }
  }
  begin(startAt, options = {}) {
    const chart = this.playChart();
    this.session = { ...options, judge: followInstrument(this.part.instrument) ? new FollowCursor(chart) : this.part.instrument === 'keyboard' ? new PitchJudge(chart) : new Judge(chart), startAt, count: 0, beat: 0, guide: 0, accountId: this.school.user?.id || null, lastProgress: 0, part: this.part, arrangement: this.arrangement };
    const from = options.from || 0;
    if (from > 0) {
      this.session.beat = chart.beats.findIndex(beat => beat.time >= from); if (this.session.beat < 0) this.session.beat = chart.beats.length;
      this.session.guide = chart.notes.findIndex(note => note.time >= from); if (this.session.guide < 0) this.session.guide = chart.notes.length;
    }
    if (options.skipCountIn) this.session.count = chart.countInBeats;
    if (this.backing && chart.passes && (!this.rooms.room || options.teacher)) { for(const segment of backingSegments(chart,this.backing))this.audio.playBacking(this.backing.buffer,startAt+segment.when,segment.offset,this.backing.volume,segment.duration); }
    else if (this.backing && (!this.rooms.room || options.teacher)) {
      const position = Math.max(from, this.backing.offset), offset = Math.max(0, from - this.backing.offset);
      const duration = Math.min(this.backing.buffer.duration - offset, chart.duration - position);
      if (duration > 0) this.audio.playBacking(this.backing.buffer, startAt + position, offset, this.backing.volume, duration);
    }
    this.q('b-report').hidden = true; this.lockControls(); this.q('b-feedback').textContent = options.teacher ? 'The shared count-in is scheduled.' : followInstrument(this.part.instrument) ? 'Follow your part after the count-in. This part is not scored.' : options.listen ? 'Listen first. This run is not scored.' : 'Count in, then meet each note in its hit box.';
    if (!options.teacher) { this.q('b-input-controls').open = false; if (!this.expanded) this.q('b-stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  stop(reason = '', announce = true, partial = false) {
    const played=this.session?this.audio.audibleTime()-this.session.startAt:-1;
    this.token++; const session = this.session; this.session = null; this.clearHeld(); this.audio.silence();
    this.singing?.stopped();
    if (session?.takeId && announce) {
      if (session.teacher) this.rooms?.unready(reason);
      else this.rooms?.link.send({ type: 'interrupt', takeId: session.takeId, reason });
    }
    if (reason) this.message(reason);
    if(partial && session && played>=0 && !session.listen && !session.teacher && !session.judge.followAlong)this.captureAttempt(session,true,played);
    this.lockControls(); this.q('b-play-status').textContent = 'Ready when you are.';
  }
  lockControls() {
    const room = this.rooms?.room, locked = !!this.session || !!room, inputLocked = !!this.session || room?.state === 'playing';
    this.q('b-loop-controls').hidden=!!room||followInstrument(this.part.instrument);
    for(const id of ['b-loop-enabled','b-loop-from','b-loop-to','b-loop-repeats'])this.q(id).disabled=locked;
    for (const id of ['b-song', 'b-part', 'b-open-import']) this.q(id).disabled = locked;
    for (const id of ['b-channel', 'b-offset', 'b-octave', 'b-device', 'b-reset-keys', 'b-connect', 'b-kit']) this.q(id).disabled = inputLocked;
    for (const button of this.q('b-bindings').querySelectorAll('button')) button.disabled = inputLocked;
    this.q('b-play').disabled = !!room; this.q('b-listen').disabled = !!room || !!this.session;
    this.q('b-local-volume').hidden = !!room || !(this.backing || this.arrangement.audio);
    this.q('b-play').textContent = this.session ? '■ Stop part' : '▶ Play part'; this.q('b-full-play').textContent = this.session ? '■ Stop part' : '▶ Play part'; this.q('b-full-play').disabled = !!room;
  }
  tick() {
    const session = this.session; if (!session) return;
    const chart = session.judge.chart, time = this.audio.audibleTime() - session.startAt, horizon = this.audio.context.currentTime + 0.12;
    while (session.count < chart.countInBeats) {
      const at = session.startAt + (session.from || 0) + (session.count - chart.countInBeats) * chart.countInBeatSeconds;
      if (at > horizon) break;
      if ((!session.takeId || session.teacher) && at >= this.audio.context.currentTime - 0.03) this.audio.click(at, session.count === 0); session.count++;
    }
    while (session.beat < chart.beats.length) { const beat = chart.beats[session.beat], at = session.startAt + beat.time; if (at > horizon) break; if (this.q('b-click').checked && at >= this.audio.context.currentTime - 0.03) this.audio.click(at, beat.downbeat); session.beat++; }
    const guides = session.teacher ? this.teacherGuide || (this.teacherGuide = this.arrangement.parts.flatMap(part => part.chart.notes.map(note => ({ ...note, instrument: part.instrument }))).sort((a,b) => a.time - b.time)) : chart.notes;
    while (session.guide < guides.length) {
      const note = guides[session.guide], at = session.startAt + note.time; if (at > horizon) break;
      if ((session.listen || (session.teacher && !this.backing) || (!session.teacher && this.part.instrument === 'vocals' && this.q('b-vocal-guide-enabled').checked)) && at >= this.audio.context.currentTime - 0.03) {
        if (note.pitch !== undefined) { const id = 'guide:' + session.guide; this.piano.on(id, note.pitch, 0.45, at); this.piano.off(id, at + Math.max(0.08, Math.min(this.part.instrument === 'vocals' || note.instrument === 'vocals' ? 30 : 1.5, note.duration || 0.25))); }
        else if(note.drum) this.audio.play(note.drum, at, 0.55);
      }
      session.guide++;
    }
    if (!session.listen && !session.teacher) { session.judge.advance(time - this.offset / 1000); this.stats(session.judge); }
    this.q('b-play-status').textContent = time < (session.from || 0) ? 'Count-in · ' + Math.max(1, Math.min(chart.countInBeats, chart.countInBeats + 1 + Math.floor((time - (session.from || 0)) / chart.countInBeatSeconds))) : 'Bar ' + (chart.beats.findLast(beat => beat.time <= time)?.sourceBar || chart.beats.findLast(beat => beat.time <= time)?.bar || 1) + ' / ' + (chart.sourceBars || chart.bars);
    if (session.takeId && !session.teacher && time >= 0 && performance.now() - session.lastProgress > 200) { session.lastProgress = performance.now(); this.rooms.progress(partSummary(session.judge), Math.min(chart.duration, time)); }
    if (time > chart.duration + 0.35) this.finish();
  }
  finish() {
    const session = this.session; if (!session) return;
    if (session.teacher) { this.stop('', false); return; }
    if(session.judge.followAlong) {
      if (session.part.instrument === 'vocals') this.singing.microphone.stop();
      this.lastReport={...session};this.stop('',false);this.q('b-feedback').textContent='Finished following '+session.part.name+'. No performance score was recorded.';
      this.q('b-report').hidden=false;this.q('b-report-summary').textContent=session.arrangement.title+' · '+session.part.name+' · Follow-along completed (unscored)';this.q('b-report-notes').textContent='';this.q('b-retry-save').hidden=true;this.collapse();
      this.q('b-save-state').textContent=session.takeId?'Confirming session participation…':'Follow-along complete. No performance score was recorded.';
      if(session.takeId)this.rooms.finish({mode:'follow'});return;
    }
    if(session.listen){this.stop('',false);this.q('b-feedback').textContent='Your turn. Play the part when you’re ready.';return;}
    session.judge.advance(Infinity);this.stop('',false);this.captureAttempt(session,false,session.judge.chart.duration);
  }
  captureAttempt(session, stopped, elapsed) {
    const original=session.judge,judge=stopped?stoppedJudge(original,Math.max(0,elapsed-this.offset/1000)):original;
    const reached=judge.chart.notes.length>0;
    const summary=partSummary(judge),chart=judge.chart,info=chart.practice;
    if(!reached)summary.accuracy=0;
    const report=makeRunReport(judge,{instrument:session.part.instrument,elapsed,stopped,offset:this.offset});report.planned=original.chart.notes.length;report.sourceBars=session.part.chart.sourceBars || session.part.chart.bars;
    const record={id:crypto.randomUUID(),at:Date.now(),...summary,sourceKind:session.arrangement.sourceKind,sourceId:session.arrangement.id,revisionId:session.arrangement.revisionId,partId:session.part.id,partName:session.part.name,instrument:session.part.instrument,title:session.arrangement.title,bpm:chart.bpm,endBpm:chart.tempos?.at(-1)?.bpm||chart.bpm,tolerance:140,section:info?info.startBar+'–'+info.endBar:'1–'+chart.bars,repeats:info?.repeats||1,full:!stopped&&(info?.full??true),focus:session.part.instrument,stopped,report};
    this.lastReport={...session,judge,runRecord:record,detail:report};this.collapse();this.stats(judge);this.report(this.lastReport,summary);if(reached)this.onAttempt?.(record,report);
    if(!document.hidden)this.onReport?.(record,report);
    if(!reached && session.takeId && !stopped)this.rooms.finish(summary);
    if(!reached)this.q('b-save-state').textContent='No expected notes reached. This preview does not add a saved attempt.';
    else if(session.takeId && !stopped){this.q('b-save-state').textContent='Confirming this session result…';this.rooms.finish(summary);}
    else if(session.accountId && this.school.user?.id===session.accountId && ['duet','school'].includes(session.arrangement.sourceKind)){
      this.pendingResult={accountId:session.accountId,id:record.id,sourceKind:record.sourceKind,sourceId:record.sourceId,revisionId:record.revisionId,partId:record.partId,summary,report,...(info?{practice:{enabled:true,startBar:info.startBar,endBar:info.endBar,repeats:info.repeats,focus:'all'}}:{})};this.saveResult();
    }else this.q('b-save-state').textContent='Attempt kept in this browser. Publish personal arrangements to school to save account reports.';
  }
  async attachTakeReport(takeId) {
    const last=this.lastReport;if(!last?.detail||!last.detail.notes.length||last.takeId!==takeId||last.detail.stopped)return;
    try{await this.school.request('/band/takes/'+takeId+'/report',{method:'POST',data:{report:last.detail}});await this.school.refreshHistory();}
    catch(error){this.q('b-save-state').textContent='Session result saved; note detail could not save: '+error.message;}
  }
  async saveResult() {
    const pending = this.pendingResult; if (!pending || pending.accountId !== this.school.user?.id) return;
    this.q('b-retry-save').hidden = true; this.q('b-save-state').textContent = 'Saving to your school account…';
    try { await this.school.recordBand(pending, pending.accountId); if (pending !== this.pendingResult) return; if (this.school.pending.some(item => item.record.id === pending.id)) throw new Error('Keep this page open and retry when connected.'); this.pendingResult = null; this.q('b-save-state').textContent = 'Saved to your school account.'; }
    catch (error) { if (pending === this.pendingResult) { this.q('b-save-state').textContent = 'Not saved yet: ' + error.message; this.q('b-retry-save').hidden = false; } }
  }
  stats(judge) {
    if(followInstrument(this.part.instrument))return;
    const s = judge ? partSummary(judge) : { hits: 0, misses: 0, wrong: 0, extras: 0, bestStreak: 0, accuracy: 0 };
    this.q('b-stats').innerHTML = [['Matched', s.hits], ['Accuracy', judge ? Math.round(s.hits / Math.max(1, s.hits+s.misses+s.wrong+s.extras)*100) + '%' : '—'], ['Missed', s.misses], ['Wrong note', s.wrong], ['Extra', s.extras], ['Best streak', s.bestStreak]].map(([label,value]) => '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('');
  }
  report(session, summary) {
    this.q('b-report').hidden = false; this.q('b-report-summary').textContent = session.arrangement.title + ' · ' + session.part.name + ' · ' + summary.hits + '/' + summary.total + ' matched · ' + summary.wrong + ' wrong notes · ' + summary.misses + ' missed · ' + summary.extras + ' extra' + (summary.meanAbsMs === null ? '' : ' · ' + Math.round(summary.meanAbsMs) + ' ms average timing error');
    this.q('b-report-notes').textContent='Open the detailed report to zoom, review each note and choose bars to practice.';
    this.q('b-retry-save').hidden = true; this.q('b-feedback').textContent = (session.detail?.stopped?'Stopped attempt.':'Take complete.')+' Your report shows the notes reached.';
  }
  renderView() {
    const full = this.q('b-view').value === 'full';
    this.q('b-canvas').hidden = full || this.part.instrument==='vocals'; this.q('b-full-scroll').hidden = !full;this.q('b-lyrics-screen').hidden=this.part.instrument!=='vocals';
    this.q('b-canvas').setAttribute('aria-label', ['guitar','bass'].includes(this.part.instrument) ? 'Suggested string and fret '+(this.q('b-view').value==='tab'?'tablature. Follow the moving gold bar.':'highway. Play each fret when it reaches the gold box.') : this.q('b-view').value === 'highway' ? 'Instrument note highway. Play when the note enters its hit box.' : 'Drum sheet music. Follow the moving gold playhead.');
  }
  async expand() {
    const token = this.fullToken = (this.fullToken || 0) + 1;
    this.expanded = true; this.q('b-stage').classList.add('band-expanded'); this.q('b-full-controls').hidden = false;
    try { if (this.q('b-stage').requestFullscreen) { await this.q('b-stage').requestFullscreen(); if (!this.expanded || token !== this.fullToken) { if (document.fullscreenElement === this.q('b-stage')) await document.exitFullscreen(); return; } this.nativeFull = true; } } catch {}
    if (this.expanded && token === this.fullToken) this.q(this.rooms.room ? 'b-full-exit' : 'b-full-play').focus();
  }
  collapse() { if (!this.expanded) return; if (document.fullscreenElement === this.q('b-stage')) document.exitFullscreen().catch(() => {}); this.finishCollapse(); }
  finishCollapse() { this.fullToken = (this.fullToken || 0) + 1; this.expanded = false; this.nativeFull = false; this.q('b-stage').classList.remove('band-expanded'); this.q('b-full-controls').hidden = true; }
  frame() {
    if (this.active && !this.q('b-practice').hidden) this.draw();
    requestAnimationFrame(() => this.frame());
  }
  draw() {
    const chart = this.session?.judge.chart || this.playChart(), time = this.session ? this.audio.audibleTime() - this.session.startAt : this.part.instrument === 'vocals' ? this.singing.position : -0.5;
    if(this.part.instrument==='vocals') {
      const counting = this.session && time < (this.session.from || 0);
      this.karaoke.draw(chart, counting ? this.session.from || 0 : time, !!this.session && !counting, this.singing.paused || !!counting);
      if (counting) this.q('b-vocal-state').textContent = 'COUNT-IN · ' + Math.max(1, chart.countInBeats + 1 + Math.floor((time - (this.session.from || 0)) / chart.countInBeatSeconds));
      this.singing.draw(chart, time, !!this.session);
      if (chart.notes.length) {
        const target = vocalTarget(chart.notes, time), label = 'Target note · ' + target.label;
        if (this.q('b-vocal-target').textContent !== label) this.q('b-vocal-target').textContent = label;
        const canvas = this.q('b-vocal-melody'), rect = canvas.getBoundingClientRect(), width = Math.max(260, rect.width), height = 200, dpr = Math.min(2, devicePixelRatio || 1);
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
        const context = canvas.getContext('2d'); context.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawVocalStaff(context, width, height, chart, this.session ? time : Math.max(-0.5, chart.notes[0].time - 0.7));
      }
      return;
    }
    if(['guitar','bass'].includes(this.part.instrument) && this.q('b-view').value==='full'){this.frettedScore.draw(chart,time,!!this.session);return;}
    const canvas = this.q('b-canvas'), context = canvas.getContext('2d');
    if (this.part.instrument === 'drums' && this.q('b-view').value !== 'highway') {
      if (this.notation?.chart !== chart) this.notation = { chart, model: createNotation(chart) };
      if (this.q('b-view').value === 'full') { this.fullScore.draw(this.notation.model, chart, time, !!this.session, this.session?.listen); return; }
    }
    const rect = canvas.getBoundingClientRect(), width = Math.max(260, rect.width), height = Math.max(100, rect.height), dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) { canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr); }
    context.setTransform(dpr,0,0,dpr,0,0); context.clearRect(0,0,width,height);
    if(['guitar','bass'].includes(this.part.instrument)){drawFretted(context,width,height,chart,time,this.q('b-view').value==='tab');return;}
    if (this.part.instrument === 'drums' && this.q('b-view').value === 'sheet') { drawSheet(context, { width, height, dpr }, this.notation.model, chart, time, !!this.session, this.session?.listen); return; }
    if (this.part.instrument === 'drums') {
      drawDrumHighway(context, { width, height }, chart, time, { running: !!this.session, order: this.getDrumOrder?.(), flashes: this.drumFlashes, bindings: this.getDrumBindings() }); return;
    }
    const keys = this.part.instrument === 'keyboard';
    let lanes;
    if (keys) { const min = Math.min(...chart.notes.map(n=>n.pitch),60+this.octave), max = Math.max(...chart.notes.map(n=>n.pitch),72+this.octave); lanes = Array.from({length:max-min+1},(_,i)=>({ id:min+i, name:pitchName(min+i), color:[1,3,6,8,10].includes((min+i)%12)?'#b5a0ed':'#63d9c4' })); }
    else lanes = orderedDrums(chart, this.getDrumOrder?.());
    const laneWidth = width/lanes.length, hitY = height-43, speed = Math.max(45,(height-70)/3.4);
    for (let i=0;i<lanes.length;i++) {
      const lane=lanes[i], x=i*laneWidth;
      context.fillStyle = i%2 ? '#152328' : '#111e22'; context.fillRect(x,0,laneWidth,height);
      context.strokeStyle='#30484f'; context.beginPath(); context.moveTo(x,0); context.lineTo(x,height); context.stroke();
      context.fillStyle='#e8c17b12'; context.fillRect(x+3,hitY-14,laneWidth-6,28); context.strokeStyle=lane.color; context.strokeRect(x+3,hitY-14,laneWidth-6,28);
      context.font='10px system-ui'; context.fillStyle=lane.color; context.textAlign='center'; context.fillText(lane.name||lane.short,x+laneWidth/2,height-7,Math.max(5,laneWidth-4));
    }
    for (const beat of chart.beats) { const y=hitY-(beat.time-time)*speed; if(y<0||y>height)continue; context.strokeStyle=beat.downbeat?'#e8c17b55':'#294046'; context.beginPath();context.moveTo(0,y);context.lineTo(width,y);context.stroke(); }
    for (const note of chart.notes) {
      const y=hitY-(note.time-time)*speed; if(y < -50 || y > hitY+25)continue;
      const index=lanes.findIndex(lane=>lane.id===(keys?note.pitch:note.drum)); if(index<0)continue;
      const h=keys?Math.max(8,Math.min(38,(note.duration||0.1)*speed)):9;
      context.fillStyle=note.status==='hit'?'#b6f2cf':note.status==='wrong'?'#f58c99':note.status==='miss'?'#526367':lanes[index].color;
      context.fillRect(index*laneWidth+5,y-h/2,Math.max(3,laneWidth-10),h);
    }
    context.strokeStyle='#e8c17b';context.lineWidth=2;context.beginPath();context.moveTo(0,hitY);context.lineTo(width,hitY);context.stroke();context.lineWidth=1;
  }
  download(name, body, type) { const url = URL.createObjectURL(new Blob([body], {type})), link = document.createElement('a'); link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
}
