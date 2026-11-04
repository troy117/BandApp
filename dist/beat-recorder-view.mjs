import { DRUMS, keyLabel } from './engine.mjs';
import { DrumAudio } from './audio.mjs';
import { BeatRecorder, BEAT_LIMITS } from './beat-recorder.mjs';
import { BeatLibrary } from './beat-library.mjs';

const beatClock = seconds => `${Math.floor(Math.max(0,seconds) / 60)}:${String(Math.floor(Math.max(0,seconds) % 60)).padStart(2,'0')}${seconds < 10 ? '.' + Math.floor(Math.max(0,seconds) % 1 * 10) : ''}`;

export class BeatRecorderView {
  constructor({ beforeOpen, openControls, getBindings, getOffset }) {
    Object.assign(this, { beforeOpen, openControls, getBindings, getOffset });
    this.library = new BeatLibrary(); this.revision = 0; this.loading = false; this.saving = false; this.savedId = null; this.flashes = new Map();
    this.dialog = document.createElement('dialog'); this.dialog.id = 'beat-recorder'; this.dialog.className = 'beat-recorder';
    this.dialog.setAttribute('aria-labelledby','rec-title');
    this.dialog.innerHTML = `<div class="dialog-header"><div><p class="eyebrow">DRUMS · CREATE & PRACTICE</p><h2 id="rec-title">Record a beat</h2></div><button id="rec-close" class="close-button" aria-label="Close beat recorder">×</button></div>
      <p class="dialog-description">Loop an audio file, play your own drum part, then listen and play along. Records the timing, strength and type of your kit, keyboard or pad hits; playback uses Groove Lab drum sounds. No microphone or kit audio is recorded. No scoring.</p>
      <p id="rec-message" class="rec-message" role="status" tabindex="-1">Choose a WAV file to begin.</p>
      <section aria-labelledby="rec-audio-heading"><h3 id="rec-audio-heading">1. Choose your audio</h3><label class="rec-file">Audio file <input id="rec-file" type="file" accept=".wav,.wave,.mp3,.m4a,.ogg,audio/*"></label><p id="rec-file-info">WAV recommended · up to 60 MB / 10 minutes. Uses the whole file at its original speed.</p>
      <div class="rec-settings"><label>Audio repeats<input id="rec-repeats" type="number" min="1" max="16" step="1" value="4"></label><label>Count-in tempo (BPM)<input id="rec-bpm" type="number" min="40" max="200" value="80"></label><label class="rec-check"><input id="rec-count" type="checkbox" checked> Four-beat count-in</label></div><p id="rec-plan">Choose 1–16 repeats, up to 20 minutes total. Count-in tempo does not change the audio speed.</p></section>
      <section aria-labelledby="rec-record-heading"><div class="rec-section-heading"><h3 id="rec-record-heading">2. Record your beat</h3><button id="rec-controls" class="button quiet">Kit & keyboard controls</button></div><p id="rec-input-help">Connect your drumkit in Controls, or use the keys and pads below. Existing pad mappings and input delay correction apply.</p>
      <div class="rec-actions"><button id="rec-record" class="button primary" disabled>● Record beat</button><button id="rec-stop" class="button secondary" disabled>■ Stop</button><span id="rec-position" role="timer">Ready</span></div>
      <progress id="rec-progress" max="1" value="0" aria-label="Take progress"></progress><div id="rec-pads" class="rec-pads" aria-label="Drums and keyboard controls"></div>
      <p class="rec-small">Each repeat is recorded separately in one take. Stop keeps the part you played. Record again replaces the current take; save a take first to keep it.</p></section>
      <section aria-labelledby="rec-practice-heading"><h3 id="rec-practice-heading">3. Listen & practice</h3><p id="rec-take-info">Your recorded beat will appear here.</p><canvas id="rec-timeline" height="230" aria-label="Recorded drum hits across the take; the white line shows playback progress." hidden></canvas>
      <div class="rec-actions"><button id="rec-replay" class="button primary" disabled>▶ Play audio + beat</button><button id="rec-replay-stop" class="button secondary" disabled>■ Stop playback</button><label>Audio volume <input id="rec-audio-volume" aria-label="Recorded take audio volume" type="range" min="0" max="100" value="65"></label><label>Recorded beat volume <input id="rec-beat-volume" aria-label="Recorded beat volume" type="range" min="0" max="100" value="80"></label></div><p class="rec-small">Play along freely during playback. Turn the recorded beat down to try it yourself. Stop ends playback; Play starts from the beginning.</p>
      <div class="rec-save"><label>Take name<input id="rec-name" maxlength="100" placeholder="My drum beat"></label><button id="rec-save" class="button secondary" disabled>Save on this device</button></div><p id="rec-storage" class="rec-small">Unsaved takes last for this visit. Saved takes include the audio file and drum hits, stay in this browser, and are available to anyone using this browser. They do not sync to school accounts and can be lost if browser data is cleared.</p></section>
      <details id="rec-library"><summary>Saved beats on this device</summary><div id="rec-saved-list"></div></details><div class="dialog-actions"><button id="rec-done" class="button secondary">Close recorder</button></div>`;
    document.body.append(this.dialog);
    this.engine = new BeatRecorder(new DrumAudio(), message => {
      this.message(message); this.render();
      if (this.isOpen && !this.loading && !this.engine.busy && this.engine.take && this.shownTake !== this.engine.take) this.q('replay').focus();
      this.shownTake = this.engine.take;
    });
    this.q('close').onclick = () => this.close();
    this.q('done').onclick = () => this.close();
    this.dialog.addEventListener('close', () => { this.revision++; this.engine.stop(); this.loading = false; cancelAnimationFrame(this.frameId); });
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.q('file').onchange = () => this.loadFile(this.q('file').files[0]);
    for (const id of ['repeats','bpm','count']) this.q(id).addEventListener('input', () => this.renderPlan());
    this.q('record').onclick = () => this.start('record'); this.q('replay').onclick = () => this.start('replay');
    this.q('stop').onclick = () => this.interrupt('Stopped. Your take is ready to play or save.');
    this.q('replay-stop').onclick = () => this.interrupt('Playback stopped. Play starts from the beginning.');
    this.q('controls').onclick = () => { this.interrupt('Controls opened. Start again when ready.'); this.openControls(); };
    this.q('audio-volume').oninput = () => { this.engine.backingVolume = Number(this.q('audio-volume').value)/100; this.engine.audio.setBackingVolume(this.engine.backingVolume); };
    this.q('beat-volume').oninput = () => { this.engine.beatVolume = Number(this.q('beat-volume').value)/100; };
    this.q('save').onclick = () => this.save();
    this.q('library').addEventListener('toggle', () => { if (this.q('library').open) this.list(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.interrupt('Stopped because this tab was hidden. Your recorded part is kept.'); });
    window.addEventListener('blur', () => this.interrupt('Stopped because the window lost focus. Your recorded part is kept.'));
    window.addEventListener('pagehide', () => this.close());
    window.addEventListener('popstate', () => this.close());
  }
  q(id) { return this.dialog.querySelector('#rec-' + id); }
  get isOpen() { return this.dialog.open; }
  get acceptsInput() { return this.isOpen && ![...document.querySelectorAll('dialog[open]')].some(dialog => dialog !== this.dialog); }
  message(text) { this.q('message').textContent = text; }
  open() {
    if (this.isOpen) return;
    try { this.beforeOpen(); this.dialog.showModal(); this.message(this.engine.take ? 'Your take is ready. Play it back, or record another beat.' : this.engine.source ? 'Audio ready. Choose repeats, then record your beat.' : 'Choose a WAV file to begin.'); this.renderPads(); this.render(); this.animate(); this.q(this.engine.take ? 'replay' : this.engine.source ? 'record' : 'file').focus(); if(this.q('library').open)this.list(); }
    catch (error) { return error.message; }
  }
  close() { this.engine.stop('Recorder closed. Your current take is kept for this visit.'); if (this.isOpen) this.dialog.close(); }
  clear() { this.close(); this.engine.clear(); this.savedId = null; this.q('file').value = ''; this.q('name').value = ''; this.message('Choose a WAV file to begin.'); this.render(); }
  interrupt(message) { if(this.engine.busy) { this.engine.stop(message); this.render(); } }
  options() { return { repeats: Number(this.q('repeats').value), bpm: Number(this.q('bpm').value), countIn: this.q('count').checked, offset: this.getOffset()/1000 }; }
  async start(mode) {
    if (this.loading || this.saving || this.engine.busy) return;
    try { this.beforeOpen(); await this.engine.start(mode, this.options()); }
    catch (error) { this.message(error.message); this.render(); }
    if (this.engine.busy) this.q(mode === 'replay' ? 'replay-stop' : 'stop').focus();
  }
  async loadFile(file) {
    if (!file || this.engine.busy || this.loading || this.saving) return;
    const revision = ++this.revision; this.loading = true; this.message('Opening audio…'); this.render();
    try {
      if (!file.size || file.size > BEAT_LIMITS.bytes) throw new Error('Choose an audio file up to 60 MB.');
      const bytes = await file.arrayBuffer();
      const buffer = await this.engine.audio.decodeBacking(bytes.slice(0));
      if (revision !== this.revision) return;
      this.engine.setSource({ name: file.name, bytes, buffer });
      this.savedId = null; this.q('name').value = file.name.replace(/\.[^.]+$/, '') + ' — drums';
    } catch (error) { if (revision === this.revision) this.message(error.message + ' The previous audio and take are unchanged.'); }
    finally { if (revision === this.revision) { this.loading = false; this.q('file').value = ''; this.render(); } }
  }
  key(event) {
    if (!this.acceptsInput) return;
    const native = event.nativeEvent, code = event.controlId.slice('keyboard:'.length);
    if (code === 'Escape') return; // Native dialog cancel closes and stops once.
    if (native.target.closest?.('button, a, summary') && (code === 'Space' || code === 'Enter')) return;
    const drum = DRUMS.find(item => this.getBindings()[item.id].includes(code));
    if (drum) { native.preventDefault(); this.hit(drum.id, event.timestamp); }
  }
  hit(drum, timestamp, velocity = 1, sound = true) {
    if (!this.acceptsInput) return;
    this.flashes.set(drum, performance.now());
    if (sound && !this.engine.busy && this.engine.audio.context?.state !== 'running') {
      const revision = this.revision, when = performance.now();
      this.engine.audio.ready().then(() => {
        if (this.acceptsInput && revision === this.revision && !this.engine.busy && performance.now() - when < 250) this.engine.audio.play(drum, undefined, velocity);
      }).catch(error => { if (this.acceptsInput && revision === this.revision) this.message(error.message); });
    }
    this.engine.hit(drum, timestamp, velocity, sound);
  }
  renderPads() {
    this.q('pads').replaceChildren();
    for (const drum of DRUMS) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.drum = drum.id;
      button.textContent = `${drum.name} · ${this.getBindings()[drum.id].map(keyLabel).join(' / ') || 'No key'}`;
      button.style.setProperty('--pad-color',drum.color);
      button.addEventListener('pointerdown', event => { if(event.button!==0)return; event.preventDefault(); this.hit(drum.id, event.timeStamp); });
      button.addEventListener('click', event => { if(event.detail===0)this.hit(drum.id,event.timeStamp); });
      this.q('pads').append(button);
    }
  }
  renderPlan() {
    const duration = this.engine.source?.buffer.duration;
    this.q('plan').textContent = duration ? `${this.q('repeats').value} × ${beatClock(duration)} = ${beatClock(duration*Number(this.q('repeats').value))} planned. Count-in tempo does not change the audio speed.` : 'Choose 1–16 repeats, up to 20 minutes total. Count-in tempo does not change the audio speed.';
  }
  render() {
    const { source, take, busy } = this.engine, locked = busy || this.loading || this.saving;
    for (const id of ['file','repeats','bpm','count','name']) this.q(id).disabled = locked;
    this.q('record').disabled = locked || !source; this.q('record').textContent = take ? '● Record again' : '● Record beat';
    this.q('replay').disabled = locked || !take; this.q('stop').disabled = !busy;
    this.q('replay-stop').disabled = !busy;
    this.q('save').disabled = locked || !take; this.q('save').textContent = take && take.id === this.savedId ? 'Update saved take' : 'Save on this device';
    this.q('file-info').textContent = source ? `${source.name} · ${beatClock(source.buffer.duration)} per repeat. Choosing new audio replaces the current unsaved take.` : 'WAV recommended · up to 60 MB / 10 minutes. Uses the whole file at its original speed.';
    this.q('take-info').textContent = take ? `${take.hits.length} hits · ${beatClock(take.duration)} · ${Math.min(take.repeats,Math.ceil(take.duration/take.loopSeconds))} of ${take.repeats} repeats · ${take.id === this.savedId ? 'Saved on this device' : 'Not saved yet'}. No timing is quantized.` : 'Your recorded beat will appear here.';
    this.q('timeline').hidden = !take;
    this.q('library').querySelectorAll('button').forEach(button => { button.disabled = locked; });
    this.renderPlan();
  }
  animate() {
    if (!this.isOpen) return;
    const { run, take } = this.engine, time = run ? this.engine.position() : 0;
    this.q('position').textContent = run ? time < 0 ? `Count-in · ${Math.max(1,Math.ceil(-time*run.plan.bpm/60))}` : `${run.mode === 'record' ? 'Recording' : 'Playing'} · repeat ${Math.min(run.plan.repeats,1+Math.floor(time/run.plan.loopSeconds))}/${run.plan.repeats} · ${beatClock(time)} / ${beatClock(run.plan.duration)}${run.mode === 'record' ? ' · '+run.hits.length+' hits' : ''}` : 'Ready';
    this.q('progress').value = run ? Math.max(0, Math.min(1,time/run.plan.duration)) : 0;
    for (const button of this.q('pads').children) button.classList.toggle('rec-hit',performance.now()-(this.flashes.get(button.dataset.drum)||-Infinity)<120);
    if (take) this.drawTimeline(take, run?.mode === 'replay' ? time : 0);
    this.frameId = requestAnimationFrame(() => this.animate());
  }
  drawTimeline(take, time) {
    const canvas = this.q('timeline'), width = Math.max(250,canvas.clientWidth), height = 230, dpr = Math.min(devicePixelRatio || 1,2);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==height*dpr){canvas.width=Math.round(width*dpr);canvas.height=height*dpr;}
    const output=canvas.getContext('2d');output.setTransform(dpr,0,0,dpr,0,0);output.clearRect(0,0,width,height);
    const left=86, span=width-left-12, x=t=>left+span*t/take.duration;
    if(this.timelineTake!==take||this.timelineWidth!==width||this.timelineDpr!==dpr){
    const backdrop=document.createElement('canvas');backdrop.width=canvas.width;backdrop.height=canvas.height;
    const ctx=backdrop.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.font='10px system-ui';
    DRUMS.forEach((drum,i)=>{const y=18+i*20;ctx.fillStyle=drum.color;ctx.fillText(drum.short,3,y+3);ctx.fillStyle='#536568';ctx.fillRect(left,y,span,1);});
    ctx.fillStyle='#b8c9c4';for(let i=0;i<take.repeats;i++){if(i*take.loopSeconds>=take.duration)break;ctx.fillRect(x(i*take.loopSeconds),5,1,205);ctx.fillText(String(i+1),x(i*take.loopSeconds)+3,222);}
    for(const hit of take.hits){const index=DRUMS.findIndex(d=>d.id===hit.drum);ctx.fillStyle=DRUMS[index].color;ctx.fillRect(x(hit.time),13+index*20,2,10);}
    this.timeline=backdrop;this.timelineTake=take;this.timelineWidth=width;this.timelineDpr=dpr;
    }
    output.drawImage(this.timeline,0,0,width,height);output.fillStyle='#fff';output.fillRect(x(Math.max(0,Math.min(time,take.duration))),4,2,207);
  }
  async save() {
    if (this.engine.busy || this.loading || this.saving || !this.engine.take) return;
    const take=this.engine.take, source=this.engine.source, revision=this.revision;
    this.saving=true;this.render();
    try { await this.library.save(take,source,this.q('name').value);if(revision===this.revision){this.savedId=take.id;this.message('Saved on this device, including the audio. Find it in Saved beats below.');await this.list();} }
    catch(error){if(revision===this.revision)this.message(error.message);}
    finally{this.saving=false;this.render();}
  }
  async list() {
    const revision=this.revision;
    try {
      const takes=await this.library.list();if(revision!==this.revision)return;
      const list=this.q('saved-list');list.replaceChildren();
      if(!takes.length)list.textContent='No saved beats on this device yet.';
      for(const item of takes){
        const row=document.createElement('div');row.className='rec-saved-row';
        const label=document.createElement('span');label.textContent=`${item.name} · ${beatClock(item.take.duration)} · ${item.take.hits.length} hits`;
        const open=document.createElement('button');open.className='button secondary';open.textContent='Open';open.setAttribute('aria-label','Open '+item.name);open.onclick=()=>this.loadSaved(item.id);
        const remove=document.createElement('button');remove.className='button quiet';remove.textContent='Delete';remove.setAttribute('aria-label','Delete '+item.name);remove.onclick=()=>this.removeSaved(item);
        row.append(label,open,remove);list.append(row);
      }this.render();
    } catch(error){if(revision===this.revision)this.q('saved-list').textContent=error.message;}
  }
  async loadSaved(id) {
    if(this.engine.busy||this.loading||this.saving)return;
    const revision=++this.revision;this.loading=true;this.message('Opening saved beat…');this.render();
    try {
      const item=await this.library.get(id);if(!item)throw new Error('This saved beat is no longer available.');
      if(!(item.bytes instanceof ArrayBuffer)||item.bytes.byteLength>BEAT_LIMITS.bytes)throw new Error('The saved audio is invalid.');
      const buffer=await this.engine.audio.decodeBacking(item.bytes.slice(0));if(revision!==this.revision)return;
      this.engine.setSource({name:item.fileName,bytes:item.bytes,buffer},item.take);this.savedId=id;this.q('name').value=item.name;
      this.q('repeats').value=item.take.repeats;this.q('bpm').value=item.take.bpm;this.q('count').checked=item.take.countIn;
    }catch(error){if(revision===this.revision)this.message(error.message);}
    finally{if(revision===this.revision){this.loading=false;this.render();}}
  }
  async removeSaved(item) {
    if(this.engine.busy||this.loading||this.saving)return;
    if(!confirm(`Delete “${item.name}” from this device?`))return;
    this.saving=true;this.render();
    try{await this.library.remove(item.id);if(this.savedId===item.id)this.savedId=null;this.message('Deleted the saved copy. Any currently open take remains available for this visit.');await this.list();}
    catch(error){this.message(error.message);}
    finally{this.saving=false;this.render();}
  }
}
