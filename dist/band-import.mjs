import { validateTimingMap } from './timing-map.mjs';
import { validateVocalNotes } from './vocal-guide.mjs';
import { backingChoices, backingFileKind, validateBackingTracks, withBacking } from './backing-tracks.mjs';
import { LyricTiming, plainLyricLines } from './lyric-timing.mjs';
import { BandBacking } from './band-backing.mjs';
import {STANDARD_STRINGS,DROP_D_STRINGS,retunePart} from './fretted-parts.mjs';
import { parseMidiSong, validatePickup } from './midi.mjs';
import { DEFAULT_MIDI_MAPPING } from './midi-input.mjs';
import { validDrumMapping } from './engine.mjs';
import { arrangementParts, importedArrangement } from './arrangements.mjs';
import { validateAlignment } from './sync.mjs';
import { validateAudioRange } from './backing-range.mjs';
import { escapeHtml } from './song-import.mjs';
import { BAND_INSTRUMENTS } from './follow-along.mjs';
import { lyricText, midiLyricCues, formatLyricCues, parseLyricText } from './lyrics.mjs';

export class BandImport {
  constructor(practice) {
    this.practice = practice; this.q = practice.q; this.token = 0; this.draft = null;
    const q = this.q;
    this.timing = new LyricTiming(this);
    this.backing = new BandBacking(this);
    q('b-open-import').onclick = () => practice.setMode('sync');
    q('b-import-close').onclick = () => { this.timing.pause(); this.backing.cancel(); q('b-import-panel').hidden = true; };
    for (const tab of ['audio','parts']) {
      q('b-import-'+tab+'-button').onclick = () => this.tab(tab);
      q('b-import-'+tab+'-button').onkeydown = event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); const next=tab==='audio'?'parts':'audio'; this.tab(next); q('b-import-'+next+'-button').focus(); } };
    }
    q('b-add-guitar').onclick=()=>this.attempt(()=>{if(!this.draft)throw new Error('Choose MIDI first.');this.draft.partDefinitions=this.readParts(true);let index=2;while(this.draft.partDefinitions.some(p=>p.id==='guitar-'+index))index++;this.draft.partDefinitions.push({id:'guitar-'+index,instrument:'guitar',name:'Guitar '+index,selected:[]});this.renderParts();});
    q('b-fretted-file').onchange=()=>this.attempt(()=>this.readFrettedGuide());
    q('b-midi-file').onchange = () => this.attempt(() => this.readMidi());
    q('b-audio-file').onchange = () => this.attempt(() => this.readAudio());
    q('b-clear-audio').onclick=()=>this.attempt(()=>this.removeBacking());
    q('b-add-backing').onclick=()=>this.attempt(()=>this.addBacking());
    q('b-edit-backing').onchange=()=>this.attempt(()=>this.chooseBacking(q('b-edit-backing').value));
    q('b-backing-label').oninput=()=>{const track=this.currentBacking();if(track){track.label=q('b-backing-label').value;this.renderBackingChoices();}};
    q('b-backing-default').onchange=()=>{if(this.draft && q('b-backing-default').checked)this.draft.defaultBackingId=this.draft.backingId;this.renderBackingChoices();};
    q('b-backing-lyrics-clear').onclick=()=>{const track=this.currentBacking();if(track)for(const key of ['lyricsText','lyricsClock','lyricsOffset'])delete track[key];this.renderVocalState();};
    q('b-vocal-notes-file').onchange=()=>this.attempt(()=>this.readVocalNotes());
    q('b-import-apply').onclick = () => this.attempt(() => this.apply());
    q('b-publish-visibility').onchange = () => { if (this.draft) this.draft.schoolVisibility = q('b-publish-visibility').value; };
    q('b-publish').onclick = () => this.attempt(() => this.publish());
    q('b-setup-save').onclick = () => this.attempt(() => this.downloadSetup());
    q('b-setup-file').onchange = () => this.attempt(() => this.loadSetup());
    q('b-lyrics-file').onchange = () => this.attempt(async () => {
      const file = q('b-lyrics-file').files[0]; if (!file) return;
      if (file.size > 128000) throw new Error('Choose a lyric file smaller than 10 KB.');
      const token = this.token, text = lyricText(await file.text()); if (token !== this.token) return;
      this.timing.reset();
      if (file.name.toLowerCase().endsWith('.txt') && !/\[\d+:|-->|^WEBVTT/m.test(text)) {
        plainLyricLines(text); q('b-lyric-plain').value = text; q('b-lyric-timing').open = true; q('b-lyrics-editor').open = true;
        q('b-import-state').textContent = 'Plain lyrics loaded. Start line timing with the matching recording, then apply and publish the vocal part.';
      } else {
        parseLyricText(text); q('b-lyrics-text').value = text; q('b-lyrics-clock').value = 'recording';
        q('b-import-state').textContent = 'Timed lyrics loaded. Check the timestamp clock before publishing.';
      }
    });
  }
  async attempt(action) { try { await action(); } catch (error) { this.q('b-import-state').textContent = error.message; } }
  reset() { this.timing.reset(); this.backing.cancel(); this.token++; this.draft = null; this.requestedTab = 'parts'; this.q('b-import-panel').hidden = true; this.q('b-import-tracks').textContent = ''; for (const id of ['b-midi-file', 'b-audio-file', 'b-setup-file', 'b-import-title','b-lyrics-text','b-lyrics-file','b-lyric-plain']) this.q(id).value = ''; this.q('b-import-state').textContent = ''; this.q('b-lyric-detected').textContent='';this.q('b-lyrics-editor').open=false;this.q('b-publish').textContent = 'Publish new school song'; this.backing.reset(); }
  tab(tab) {
    this.requestedTab = tab; this.backing?.stop(); this.timing.pause();
    for (const name of ['audio','parts']) { const active=name===tab; this.q('b-import-'+name+'-tab').hidden=!active; this.q('b-import-'+name+'-button').setAttribute('aria-selected',String(active)); this.q('b-import-'+name+'-button').tabIndex=active?0:-1; }
    this.q('b-import-heading').textContent = tab==='audio' ? 'Audio & backing' : 'Prepare your band song';
    if (tab==='audio') { this.q('b-audio-sync').open=true; this.backing?.render(); }
  }
  currentBacking() { return this.draft?.backingTracks?.find(track=>track.id===this.draft.backingId); }
  backingIdle() { if(this.publishing || this.switching || this.draft?.pendingAudio)throw new Error('Wait for the backing to finish loading or publishing.'); }
  flushBacking() {
    const track=this.currentBacking();if(!track)return;
    if(this.draft.pendingAudio || this.draft.audioFailed)throw new Error('Choose a supported audio file before switching backings.');
    const q=this.q, range=this.draft.buffer ? validateAudioRange({audioStart:Number(q('b-audio-start').value || 0),audioEnd:q('b-audio-end').value===''?null:Number(q('b-audio-end').value)},this.draft.buffer.duration) : {};
    Object.assign(track,{bytes:this.draft.audioBytes,audioBytes:this.draft.audioBytes?.byteLength || 0,audioName:this.draft.audioName,label:q('b-backing-label').value || track.label,...validateAlignment(Number(q('b-import-offset').value),100/Number(q('b-import-speed').value)),volume:Number(q('b-import-volume').value)/100,audioStart:range.audioStart ?? 0,audioEnd:range.audioEnd ?? null,timingMap:this.draft.timingMap || undefined});
  }
  renderBackingChoices() {
    const q=this.q, tracks=this.draft?.backingTracks || [], selected=this.currentBacking();
    q('b-edit-backing').innerHTML=tracks.length ? tracks.map(track=>'<option value="'+track.id+'">'+escapeHtml(track.label || 'New backing')+(track.id===this.draft.defaultBackingId?' · Default':'')+'</option>').join('') : '<option value="">No backing yet</option>';
    q('b-edit-backing').value=selected?.id || ''; q('b-backing-label').value=selected?.label || '';
    q('b-backing-default').checked=!!selected && selected.id===this.draft.defaultBackingId;
    q('b-add-backing').disabled=!this.draft || tracks.length>=6 || !!this.publishing;
  }
  addBacking() {
    this.backingIdle();if(!this.draft)throw new Error('Choose MIDI first.');
    if((this.draft.backingTracks?.length || 0)>=6)throw new Error('Choose up to six backing versions.');
    this.flushBacking();this.timing.reset();this.backing.cancel();
    const id='track-'+crypto.randomUUID().slice(0,8),track={id,label:'New backing',bytes:null,audioName:'',offset:0,timeScale:1,volume:.65,audioStart:0,audioEnd:null};
    (this.draft.backingTracks ??= []).push(track);this.draft.defaultBackingId ??= id;
    this.activateBacking(track,null);this.q('b-import-state').textContent='Choose an audio file for the new version. Existing versions are retained.';
  }
  activateBacking(track,buffer) {
    Object.assign(this.draft,{backingId:track?.id || null,audioBytes:track?.bytes || null,buffer,audioName:track?.audioName || '',audioStart:track?.audioStart ?? 0,audioEnd:track?.audioEnd ?? null,timingMap:track?.timingMap || null,audioFailed:false,pendingAudio:false});
    const q=this.q;q('b-import-offset').value=track?.offset ?? 0;q('b-import-speed').value=100/(track?.timeScale ?? 1);q('b-import-volume').value=(track?.volume ?? .65)*100;q('b-audio-start').value=track?.audioStart ?? 0;q('b-audio-end').value=track?.audioEnd ?? '';q('b-audio-file').value='';
    this.renderBackingChoices();this.backing.reset();
  }
  async chooseBacking(id) {
    this.backingIdle();const track=this.draft?.backingTracks.find(track=>track.id===id);if(!track)return;
    this.flushBacking();this.timing.reset();this.backing.cancel();this.switching=true;const token=this.token;
    try {const buffer=track.bytes ? await this.practice.audio.decodeBacking(track.bytes.slice(0)) : null;if(token===this.token)this.activateBacking(track,buffer);}
    finally{this.switching=false;}
  }
  async removeBacking() {
    this.backingIdle();if(!this.draft)return;this.timing.reset();this.backing.cancel();this.audioToken=(this.audioToken || 0)+1;
    this.draft.backingTracks=(this.draft.backingTracks || []).filter(track=>track.id!==this.draft.backingId);
    if(!this.draft.backingTracks.some(track=>track.id===this.draft.defaultBackingId))this.draft.defaultBackingId=this.draft.backingTracks[0]?.id || null;
    const track=this.draft.backingTracks[0],token=this.token;this.switching=true;
    try {const buffer=track?.bytes ? await this.practice.audio.decodeBacking(track.bytes.slice(0)) : null;if(token===this.token)this.activateBacking(track,buffer);}finally{this.switching=false;}
    this.q('b-import-state').textContent='Version removed from this draft. Publish to save.';
  }
  renderDraft(metadata = {}) {
    this.timing.reset(); this.q('b-lyric-plain').value = '';
    const q = this.q, song = this.draft.song;
    this.draft.partDefinitions=metadata.parts?.map(p=>({...p,id:p.id||p.instrument,name:p.name||BAND_INSTRUMENTS[p.instrument]})) || Object.entries(BAND_INSTRUMENTS).map(([id,name])=>({id,instrument:id,name,selected:song.parts.filter(p=>p.drumCandidate?id==='drums':p.bassCandidate?id==='bass':p.guitarCandidate?id==='guitar':p.keyboardCandidate?id==='keyboard':p.vocalCandidate&&midiLyricCues(song).length?id==='vocals':false).map(p=>p.id)}));
    for(const [id,name]of Object.entries(BAND_INSTRUMENTS))if(!this.draft.partDefinitions.some(p=>p.instrument===id))this.draft.partDefinitions.push({id,instrument:id,name,selected:[]});
    q('b-pickup').value=metadata.pickupQuarters||0;
    q('b-import-title').value = metadata.title || song.title;
    q('b-import-offset').value = metadata.offset ?? 0; q('b-import-speed').value = 100 / (metadata.timeScale ?? 1); q('b-import-volume').value = (metadata.volume ?? 0.65) * 100;
    Object.assign(this.draft, {audioStart:metadata.audioStart ?? 0, audioEnd:metadata.audioEnd ?? null,timingMap:metadata.timingMap || null,vocalNotes:metadata.vocalNotes});
    q('b-audio-start').value = this.draft.audioStart; q('b-audio-end').value = this.draft.audioEnd ?? '';
    q('b-publish-visibility').value = this.draft.schoolVisibility || 'school'; q('b-publish-visibility').disabled = Boolean(this.draft.schoolSource); q('b-publish-visibility-field').hidden = !this.practice?.school?.staff;
    q('b-publish').textContent = this.draft.schoolSource ? 'Publish school song update' : 'Publish new school song';
    const embedded=midiLyricCues(song);q('b-lyrics-text').value=metadata.lyricsText??formatLyricCues(embedded);q('b-lyrics-clock').value=metadata.lyricsClock||'midi';q('b-lyrics-offset').value=metadata.lyricsOffset||0;
    q('b-lyric-detected').textContent=embedded.length?embedded.length+' embedded MIDI lyric lines found. Check their words and timing before publishing.':'No embedded lyric text found. Melody notes do not include words; load or enter timed lyrics below.';
    q('b-lyrics-file').value='';
    this.renderParts();
    q('b-vocal-notes-state').textContent=this.draft.vocalNotes?.length ? this.draft.vocalNotes.length+' analyzed vocal notes retained on the MIDI timeline.' : 'No imported vocal pitch guide. Existing MIDI vocal assignments are retained.';
    this.renderBackingChoices(); this.backing?.reset(); if(this.backing)this.tab(this.requestedTab || 'parts');
  }
  renderParts() {
    const parts=this.draft.partDefinitions,assigned=new Map(parts.flatMap(p=>p.selected.map(id=>[id,p.id]))),q=this.q;
    q('b-string-parts').innerHTML=parts.filter(p=>STANDARD_STRINGS[p.instrument]).map(p=>{
      const tuning=p.tuning||STANDARD_STRINGS[p.instrument],same=t=>JSON.stringify(t)===JSON.stringify(tuning),value=same(STANDARD_STRINGS[p.instrument])?'standard':same(DROP_D_STRINGS[p.instrument])?'drop-d':'custom';
      return '<div class="string-part-editor"><label>Part name<input data-part-name="'+p.id+'" maxlength="60" value="'+escapeHtml(p.name)+'"></label><label>Tuning<select data-part-tuning="'+p.id+'"><option value="standard"'+(value==='standard'?' selected':'')+'>Standard</option><option value="drop-d"'+(value==='drop-d'?' selected':'')+'>Drop D</option>'+(value==='custom'?'<option value="custom" selected>Source tuning</option>':'')+'</select></label><small>'+(p.tablature?'Original tablature · '+p.tablature.notes.length+' notes':'MIDI fingering estimates')+'</small></div>';
    }).join('');
    q('b-import-tracks').innerHTML=this.draft.song.parts.map(p=>'<div class="band-track"><div>'+escapeHtml(p.name)+'<small>Track '+p.track+' · MIDI channel '+p.channel+' · '+p.notes.length+' notes</small></div><label>Assign to<select data-band-track="'+p.id+'"><option value="">Ignore</option>'+parts.map(part=>'<option value="'+part.id+'"'+(assigned.get(p.id)===part.id?' selected':'')+'>'+escapeHtml(part.name)+'</option>').join('')+'</select></label></div>').join('');
  }
  readParts(includeEmpty=false) {
    const chosen=[...this.q('b-import-tracks').querySelectorAll('[data-band-track]')];
    return this.draft.partDefinitions.map(def=>{
      const part={...def,name:this.q('b-string-parts').querySelector?.('[data-part-name="'+def.id+'"]')?.value.trim()||def.name,selected:chosen.filter(s=>s.value===def.id).map(s=>s.dataset.bandTrack)};
      if(JSON.stringify([...part.selected].sort())!==JSON.stringify([...def.selected].sort()))delete part.tablature;
      const tuning=this.q('b-string-parts').querySelector?.('[data-part-tuning="'+def.id+'"]')?.value;
      const target=tuning==='drop-d'?DROP_D_STRINGS[part.instrument]:STANDARD_STRINGS[part.instrument];
      return tuning&&tuning!=='custom'&&JSON.stringify(target)!==JSON.stringify(part.tuning||STANDARD_STRINGS[part.instrument])?retunePart(part,target):part;
    }).filter(p=>includeEmpty||p.selected.length||p.instrument==='vocals'&&this.q('b-lyrics-text').value.trim());
  }
  async readFrettedGuide() {
    if(!this.draft)throw new Error('Choose the matching MIDI first.');
    const file=this.q('b-fretted-file').files[0];if(!file)return;
    if(file.size>8*1024*1024)throw new Error('Choose tablature smaller than 8 MB.');
    const token=this.token,input=JSON.parse(await file.text());if(token!==this.token)return;
    if(input.format!=='bandapp-fretted-guide'||input.version!==1||input.fingerprint!==this.draft.song.fingerprint||!Array.isArray(input.parts)||input.parts.some(p=>!STANDARD_STRINGS[p.instrument]))throw new Error('Choose original tablature prepared for this exact MIDI.');
    const parts=arrangementParts(input.parts),pickupQuarters=validatePickup(input.pickupQuarters||0);
    importedArrangement(this.draft.song,{parts,pickupQuarters});
    this.draft.partDefinitions=[...this.readParts(true).filter(p=>!STANDARD_STRINGS[p.instrument]),...parts];this.q('b-pickup').value=pickupQuarters;this.renderParts();this.backing.reset();this.q('b-fretted-file').value='';
    this.q('b-import-state').textContent='Original strings, frets and techniques loaded. Check the separate parts, then publish.';
  }
  async editSchoolSong(id, tab = 'parts') {
    if (this.practice.rooms.room) throw new Error('Leave the session before editing song parts.');
    if (!this.practice.school.staff) throw new Error('Sign in as a teacher to edit song parts.');
    this.practice.stop(); this.reset(); this.requestedTab=tab; const token = this.token, school = this.practice.school;
    this.q('b-import-panel').hidden = false; this.q('b-import-state').textContent = 'Loading the existing MIDI, backing and part settings…';
    this.q('b-import-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const { song: meta } = await school.request('/library/' + id);
    if (token !== this.token) return;
    if (!meta.canManage) throw new Error('Only the publishing teacher or school owner can update this song.');
    this.q('b-editor-song').value=id;
    const bytes = await school.download('/library/' + id + '/revisions/' + meta.revisionId + '/midi');
    if (token !== this.token) return;
    const tracks=[];
    for(const track of backingChoices(meta)){
      const audioBytes=await school.download('/library/'+id+'/revisions/'+meta.revisionId+'/'+(meta.backingTracks?backingFileKind(track.id):'audio'));
      if(token!==this.token)return;tracks.push({...track,bytes:audioBytes,audioBytes:audioBytes.byteLength});
    }
    const selected=tracks.find(track=>track.id===(meta.defaultBackingId || 'main'));
    const buffer=selected ? await this.practice.audio.decodeBacking(selected.bytes.slice(0)) : null;
    if(token!==this.token)return;
    this.draft = { song:parseMidiSong(bytes,meta.fileName),bytes,fileName:meta.fileName,audioBytes:selected?.bytes || null,buffer,audioName:selected?.audioName || '',mapping:meta.mapping,schoolVisibility:meta.visibility || 'school',schoolSource:{songId:id,revisionId:meta.revisionId},backingTracks:tracks,backingId:selected?.id || null,defaultBackingId:selected?.id || null,lyricsAlignment:meta.lyricsAlignment || {offset:meta.offset,timeScale:meta.timeScale} };
    this.renderDraft(meta);
    this.q('b-import-state').textContent = 'Existing backing and alignment retained' + (meta.audioName ? ' · ' + meta.audioName : '') + '. Check the instrument assignments and lyrics, then publish the update.';
  }
  renderVocalState() {
    const count=this.draft?.vocalNotes?.length || 0,own=this.currentBacking()?.lyricsText!==undefined;
    this.q('b-vocal-notes-state').textContent=(count ? count+' analyzed vocal notes retained on the MIDI timeline.' : 'No imported vocal pitch guide. Existing MIDI vocal assignments are retained.')+(own?' This backing uses its own imported word timing; the editor below contains the base lyrics.':'');
    this.q('b-backing-lyrics-clear').hidden=!own;
  }
  async readVocalNotes() {
    if(!this.draft)throw new Error('Choose the matching MIDI first.');
    const file=this.q('b-vocal-notes-file').files[0];if(!file)return;
    if(file.size>2*1024*1024)throw new Error('Choose a vocal guide smaller than 2 MB.');
    const token=this.token,input=JSON.parse(await file.text());if(token!==this.token)return;
    if(input.format!=='bandapp-vocal-guide'||input.version!==1||!Array.isArray(input.notes)||input.fingerprint!==this.draft.song.fingerprint)throw new Error('This vocal guide must match the exact MIDI arrangement.');
    const notes=validateVocalNotes(input.notes);if(notes.some(note=>note.time+note.duration>this.draft.song.duration+.001))throw new Error('Vocal notes must fit inside the MIDI arrangement.');
    const lyrics=input.lyricsText===undefined?undefined:lyricText(input.lyricsText);
    if(lyrics!==undefined){parseLyricText(lyrics);if(!this.currentBacking())throw new Error('Choose the original backing before importing its timed lyrics.');}
    this.practice.stop();this.draft.vocalNotes=notes;
    if(lyrics!==undefined)Object.assign(this.currentBacking(),{lyricsText:lyrics,lyricsClock:'midi',lyricsOffset:0});
    this.q('b-vocal-notes-file').value='';this.renderVocalState();
    this.q('b-vocal-notes-state').textContent=notes.length+' analyzed vocal notes prepared.'+(lyrics!==undefined?' Timed lyrics apply to this backing; other versions retain their text.':'')+' Publish to save the guide.';
  }
  async readMidi() {
    const file = this.q('b-midi-file').files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose a MIDI smaller than 10 MB.');
    this.backing.cancel(); const token = ++this.token; this.draft = null; this.q('b-import-tracks').textContent = ''; this.q('b-audio-file').value = '';
    const bytes = await file.arrayBuffer(); if (token !== this.token) return;
    const song = parseMidiSong(bytes, file.name); this.draft = { song, bytes, fileName: file.name, audioBytes: null, buffer: null, audioName: '' };
    this.renderDraft();
    this.q('b-import-state').textContent = 'Instrument tracks are suggested when the MIDI identifies them. Check every assignment and any lyrics before publishing. Pitched parts keep their original notes.';
  }
  async readAudio() {
    if (!this.draft) throw new Error('Choose MIDI first.');
    const file = this.q('b-audio-file').files[0];if(!file)return;
    if(!this.currentBacking())this.addBacking();
    this.timing.reset();
    this.backing.cancel();
    if (file.size > 100 * 1024 * 1024) throw new Error('Choose audio smaller than 100 MB.');
    const token = this.token, draft = this.draft, audioToken = this.audioToken = (this.audioToken || 0) + 1;
    Object.assign(draft, { pendingAudio: true, audioFailed: false, audioBytes: null, buffer: null, audioName: '' });
    this.backing.render();
    this.q('b-import-state').textContent = 'Decoding backing recording…';
    try {
    const bytes = await file.arrayBuffer(), buffer = await this.practice.audio.decodeBacking(bytes.slice(0));
    if (token !== this.token || audioToken !== this.audioToken || draft !== this.draft) return;
    Object.assign(draft, { audioBytes: bytes, buffer, audioName: file.name, audioStart:0, audioEnd:null,timingMap:null });
    if(this.currentBacking())for(const key of ['lyricsText','lyricsClock','lyricsOffset'])delete this.currentBacking()[key];
    if(this.currentBacking()?.label==='New backing')this.q('b-backing-label').value=file.name.replace(/\.[^.]+$/,'').slice(0,80);
    this.q('b-audio-start').value=0; this.q('b-audio-end').value='';
    this.q('b-import-state').textContent = 'Backing recording decoded. Offset and speed apply to every instrument part.';
    } catch (error) { if (token === this.token && audioToken === this.audioToken) draft.audioFailed = true; throw error; }
    finally { if (audioToken === this.audioToken) { draft.pendingAudio = false; if(token===this.token && draft===this.draft){this.backing.reset();if(!draft.audioFailed)this.flushBacking();this.renderBackingChoices();} } }
  }
  metadata() {
    if (!this.draft) throw new Error('Choose a MIDI file first.');
    if (this.switching || this.draft.pendingAudio || this.draft.audioFailed) throw new Error(this.draft.pendingAudio ? 'Wait for the backing recording to finish loading.' : 'Choose a supported backing recording, or remove the failed recording.');
    const q = this.q;
    const lyricsText=lyricText(q('b-lyrics-text').value||''),lyricsClock=q('b-lyrics-clock').value||'midi',lyricsOffset=Number(q('b-lyrics-offset').value||0);
    const parts=this.readParts(),pickupQuarters=validatePickup(Number(q('b-pickup').value||0));
    arrangementParts(parts);
    const title = q('b-import-title').value.trim();
    if (!title || title.length > 120 || /[\u0000-\u001f]/.test(title)) throw new Error('Enter a song title of 1–120 characters.');
    const alignment = validateAlignment(Number(q('b-import-offset').value), 100 / Number(q('b-import-speed').value)), volume = Number(q('b-import-volume').value) / 100;
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Choose a backing volume.');
    const range = this.draft.buffer ? validateAudioRange({audioStart:Number(q('b-audio-start').value || 0), audioEnd:q('b-audio-end').value === '' || q('b-audio-end').value === undefined ? null : Number(q('b-audio-end').value)}, this.draft.buffer.duration) : {};
    this.flushBacking();
    const tracks=(this.draft.backingTracks || []).map(({bytes,...track})=>track);
    validateBackingTracks(tracks,this.draft.defaultBackingId || null);
    const result = { title, pickupQuarters, fileName: this.draft.fileName, audioName: this.draft.audioName, midiBytes: this.draft.bytes.byteLength, audioBytes: this.draft.audioBytes?.byteLength || 0, parts, selected: (parts.find(part => part.instrument === 'drums') || parts[0]).selected, mapping: { ...(this.draft.mapping ?? DEFAULT_MIDI_MAPPING) }, ...alignment, ...range, volume, arrangementVersion: 1, lyricsText,lyricsClock,lyricsOffset,backingTracks:tracks,defaultBackingId:this.draft.defaultBackingId || null,lyricsAlignment:this.draft.lyricsAlignment || {...alignment,timingMap:this.draft.timingMap || null},...(this.draft.vocalNotes!==undefined?{vocalNotes:validateVocalNotes(this.draft.vocalNotes)}:{}) };
    return {...withBacking(result,result.defaultBackingId),lyricsText,lyricsClock,lyricsOffset};
  }
  async apply() {
    this.timing.pause(); this.backing.cancel();
    const meta = withBacking(this.metadata(),this.draft.backingId), arrangement = importedArrangement(this.draft.song, meta);
    if (this.draft.buffer) arrangement.backing = { buffer: this.draft.buffer, offset: meta.offset, volume: meta.volume, name: meta.audioName, ...validateAudioRange(meta) };
    this.practice.stop(); this.practice.useArrangement(arrangement); this.q('b-import-state').textContent = 'Ready for local practice. Publish to school for other computers and saved account results.';
    if(this.practice.mode==='sync')this.practice.setMode(arrangement.parts.find(part=>part.instrument==='keyboard')?.instrument || arrangement.parts[0].instrument);
  }
  async publish() {
    this.timing.pause(); this.backing.cancel();
    const school = this.practice.school;
    if (!school.staff) throw new Error('Sign in as a teacher to publish an arrangement.');
    const meta = this.metadata(), draft = this.draft, token = this.token;
    importedArrangement(draft.song, meta); this.publishing=true; this.backing.render();
    let upload;
    try {
      this.q('b-import-state').textContent = 'Publishing the MIDI, backing and instrument settings…';
      upload = await school.request('/library/uploads', { method: 'POST', data: { ...meta, visibility: draft.schoolVisibility || 'school', ...draft.schoolSource } });
      const id = upload.uploadId;
      if (!id) throw new Error('The upload did not return a song revision.');
      await school.request('/library/uploads/' + id + '/midi', { method: 'PUT', data: draft.bytes });
      for(const track of draft.backingTracks || [])await school.request('/library/uploads/'+id+'/'+backingFileKind(track.id),{method:'PUT',data:track.bytes});
      const published = await school.request('/library/uploads/' + id + '/publish', { method: 'POST', data: {} });
      if (token !== this.token) return;
      draft.schoolSource = { songId: published.song.id, revisionId: published.song.revisionId };
      this.q('b-publish').textContent = 'Publish school song update';
      await this.practice.refreshCatalog();
      await this.practice.loadChoice('school:' + published.song.id);
      this.q('b-import-state').textContent = 'Published to the school library. All parts, lyrics and backing settings travel together.';
    } finally { this.publishing=false; this.backing.render(); }
  }
  downloadSetup() {
    const metadata = withBacking(this.metadata(),this.draft.backingId), setup = { format: 'groove-lab-arrangement', version: 1, fingerprint: this.draft.song.fingerprint, ...metadata };
    delete setup.midiBytes; delete setup.audioBytes;
    this.practice.download('arrangement-setup.json', JSON.stringify(setup, null, 2), 'application/json');
  }
  async loadSetup() {
    if (!this.draft) throw new Error('Load the matching MIDI first.');
    const file = this.q('b-setup-file').files[0]; if (!file) return;
    if (file.size > 8*1024*1024) throw new Error('Choose an arrangement setup smaller than 8 MB.');
    const token = this.token, setup = JSON.parse(await file.text()); if (token !== this.token) return;
    if (setup.format !== 'groove-lab-arrangement' || setup.version !== 1 || setup.fingerprint !== this.draft.song.fingerprint) throw new Error('This setup must match the exact MIDI file.');
    const parts = arrangementParts(setup.parts);
    importedArrangement(this.draft.song, setup); validateAlignment(setup.offset, setup.timeScale);
    const loadedMap=validateTimingMap(setup.timingMap);const loadedNotes=validateVocalNotes(setup.vocalNotes);
    if(loadedMap && setup.audioName!==this.draft.audioName)throw new Error('Load the matching backing file before restoring its timing map.');
    const base=setup.baseLyrics || setup,selected=setup.backingTracks?.find(track=>track.id===setup.backingId);
    if(base.lyricsText!==undefined)lyricText(base.lyricsText);
    const range=validateAudioRange(setup, this.draft.buffer?.duration);
    if (!Number.isFinite(setup.volume) || setup.volume < 0 || setup.volume > 1 || typeof setup.title !== 'string' || !setup.title.trim() || setup.title.length > 120) throw new Error('Invalid arrangement setup.');
    this.draft.partDefinitions=parts;this.renderParts();this.q('b-pickup').value=setup.pickupQuarters||0;
    if (setup.mapping !== undefined) {
      if (!setup.mapping || typeof setup.mapping !== 'object' || Array.isArray(setup.mapping) || Object.entries(setup.mapping).some(([pitch, drum]) => !/^\d{1,3}$/.test(pitch) || Number(pitch) > 127 || !validDrumMapping(drum))) throw new Error('Invalid drum assignments in this setup.');
      this.draft.mapping = { ...setup.mapping };
    }
    this.q('b-import-title').value = setup.title; this.q('b-import-offset').value = setup.offset; this.q('b-import-speed').value = 100 / setup.timeScale; this.q('b-import-volume').value = setup.volume * 100;
    this.q('b-lyrics-text').value=base.lyricsText??'';this.q('b-lyrics-clock').value=base.lyricsClock||'midi';this.q('b-lyrics-offset').value=base.lyricsOffset||0;
    if(this.currentBacking()){for(const key of ['lyricsText','lyricsClock','lyricsOffset'])delete this.currentBacking()[key];if(selected?.lyricsText!==undefined)Object.assign(this.currentBacking(),{lyricsText:lyricText(selected.lyricsText),lyricsClock:'midi',lyricsOffset:0});}
    Object.assign(this.draft, {audioStart:range.audioStart ?? 0, audioEnd:range.audioEnd ?? null,timingMap:loadedMap,...(loadedNotes!==undefined?{vocalNotes:loadedNotes}:{}),...(setup.lyricsAlignment?{lyricsAlignment:setup.lyricsAlignment}:{})});
    this.q('b-audio-start').value=this.draft.audioStart; this.q('b-audio-end').value=this.draft.audioEnd ?? '';
    this.flushBacking();this.renderBackingChoices();this.backing.reset();
    this.q('b-import-state').textContent = 'Selected backing settings restored. Add the matching backing recording, then use or publish.';
  }
}
