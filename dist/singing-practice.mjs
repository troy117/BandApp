import { VocalPerformance, vocalSummary, vocalPracticeRecord } from './vocal-performance.mjs';
import { VocalMicrophone } from './vocal-microphone.mjs';
import { vocalPitchFeedback } from './vocal-pitch.mjs';
import { vocalTarget } from './vocal-guide.mjs';
import { pitchName } from './instruments.mjs';
import { warmupMarkup, VocalWarmup } from './vocal-warmup.mjs';
import { VocalHighway } from './vocal-highway.mjs';
import { voiceStatusLabel } from './class-experience.mjs';

export function singingMarkup() {
  return `<div id="b-lyrics-screen" class="band-lyrics" hidden>
    <header class="singing-heading"><div><p class="eyebrow">YOUR VOICE. YOUR PACE.</p><h3 id="b-singing-title">Singing practice</h3><div id="b-vocal-song-slot"></div></div><button id="b-singing-expand" class="button secondary" aria-label="Expand singing practice" title="Full screen">Focus view</button></header>
    <div class="singing-mic-row" id="b-singing-mic-row"><button id="b-vocal-mic" class="button secondary" aria-pressed="false">Enable microphone</button><span id="b-vocal-mic-badge">MIC OFF</span></div>
    <div id="b-vocal-volume-slot" class="singing-volume-slot"></div><p id="b-vocal-mic-status" class="singing-mic-status" role="status">Optional pitch feedback. Your voice stays on this device.</p>
    <div id="b-vocal-views" class="singing-view-switch" role="group" aria-label="Vocal practice view"><button class="button secondary" data-vocal-view="highway" aria-pressed="true">Pitch highway</button><button class="button secondary" data-vocal-view="lyrics" aria-pressed="false">Large lyrics</button></div>
    <div class="vocal-performance-layout"><aside id="b-vocal-performance" class="vocal-performance-meter" aria-label="Vocal pitch accuracy for this attempt"><span>On pitch</span><strong id="b-vocal-accuracy">—</strong><div class="vocal-accuracy-track" role="progressbar" aria-label="Time on the correct pitch" aria-valuemin="0" aria-valuemax="100" id="b-vocal-accuracy-bar"><i id="b-vocal-accuracy-fill"></i></div><small id="b-vocal-accuracy-detail">Mic off</small></aside><section id="b-vocal-highway" class="vocal-highway" aria-label="Vocal pitch highway with lyrics"><div class="vocal-highway-legend"><span><i></i>Melody</span><span><i></i>Your voice</span><span>Higher notes ↑</span></div><canvas id="b-vocal-highway-canvas" aria-label="Vocal notes and lyrics move toward the white sing line. Higher bars mean higher pitches; longer bars mean longer holds."></canvas><p>Sing as the bars reach the white line. Word timing is approximate.</p></section>
    <div class="singing-words"><p id="b-vocal-state">READY TO SING</p><div id="b-vocal-line" aria-live="polite"></div><progress id="b-vocal-progress" max="1" value="0" aria-label="Current lyric line progress"></progress><p id="b-vocal-next"></p></div>
    </div><section id="b-vocal-pitch" class="singing-pitch" aria-label="Live pitch guide" data-state="off">
      <div class="singing-note-pair"><div><span>Target</span><strong id="b-pitch-wanted">—</strong></div><strong id="b-pitch-feedback" role="status" aria-live="polite">Sing with the lyrics</strong><div><span>You</span><strong id="b-pitch-heard">—</strong></div></div>
      <div class="singing-meter" aria-hidden="true"><span class="singing-center"></span><span id="b-pitch-dot" hidden></span></div><div class="singing-meter-labels" aria-hidden="true"><span>Too low</span><span>On pitch</span><span>Too high</span></div><p id="b-pitch-hint">Enable your microphone when you’re ready for pitch feedback.</p>
    </section>
    <aside id="b-vocal-side-meter" class="vocal-side-meter" aria-label="Live singing pitch"><span>Pitch</span><strong id="b-vocal-side-label" role="status">Mic off</strong><div class="vocal-side-track" aria-hidden="true"><span>High</span><i></i><b id="b-vocal-side-dot" hidden></b><span>Low</span></div><small>Target <b id="b-vocal-side-target">—</b></small><small>You <b id="b-vocal-side-heard">—</b></small></aside><div class="singing-player"><p id="b-singing-error" class="singing-play-error" role="alert" hidden></p><label class="singing-seek-label" for="b-singing-seek">Song position <span id="b-singing-time">0:00 / 0:00</span></label><input id="b-singing-seek" type="range" min="0" max="1" step="0.1" value="0"><div class="singing-player-buttons"><button id="b-singing-back" class="button secondary" aria-label="Practice this lyric line again">↶ Try line again</button><button id="b-singing-play" class="button primary">▶ Play song</button></div><button id="b-singing-report" class="text-button" hidden>View pitch report</button><button id="b-singing-next" class="text-button">Skip to next vocal line →</button><p id="b-singing-room" class="band-help" hidden>Your teacher controls playback in this session.</p></div>
    <details id="b-singing-settings" class="singing-details"><summary>Sound &amp; pitch settings</summary>${warmupMarkup()}<p class="band-help">Use headphones and keep your phone nearby. One voice works best. Pitch reports save to your practice history. Microphone audio stays on this device.</p><label class="band-check"><input id="b-singing-click" type="checkbox" checked>Metronome</label><label class="singing-setting" id="b-singing-volume-label" for="b-singing-volume">Background volume <output id="b-singing-volume-value">65%</output><input id="b-singing-volume" type="range" min="0" max="100" value="65"></label><label class="singing-setting">Singing range<select id="b-vocal-range"><option value="any">My comfortable octave</option><option value="exact">Exact written octave</option></select></label><p class="band-help">Comfortable octave follows the same melody higher or lower, so you can sing in your own range.</p><label class="singing-setting">Melody guide octave (sound)<select id="b-vocal-guide-octave"><option value="-24">Two octaves lower</option><option value="-12">One octave lower</option><option value="0" selected>Written octave</option><option value="12">One octave higher</option><option value="24">Two octaves higher</option></select></label><label class="singing-setting">Extra microphone delay <span id="b-vocal-delay-label">0 ms</span><input id="b-vocal-delay" type="range" min="0" max="300" step="10" value="0"></label><button id="b-vocal-delay-reset" class="text-button">Reset extra delay</button><p id="b-vocal-latency" class="band-help">Enable the mic to check its input delay.</p><p class="band-help">If your recorded voice trail lands late, pause and increase extra delay. If it lands early, reduce it. This is saved on this device; recheck after changing headsets. The live dot stays on the sing line. Wired headphones usually respond faster than Bluetooth.</p></details>
    <details id="b-vocal-melody-panel" class="singing-details" hidden><summary>Melody &amp; sheet music</summary><div class="band-row"><p id="b-vocal-target"></p><label class="band-check"><input id="b-vocal-guide-enabled" type="checkbox">Melody guide</label></div><canvas id="b-vocal-melody" aria-label="Vocal melody on a treble staff with note names and hold lengths"></canvas><p class="band-help">Follow the green line. Shaded tails show how long to hold. Headphones keep the guide out of your microphone.</p></details>
  </div>`;
}

const singingTime = value => Math.floor(Math.max(0, value) / 60) + ':' + String(Math.floor(Math.max(0, value)) % 60).padStart(2, '0');
export function vocalCaptureTime(audio, startAt, age, correctionMs, now = performance.now()) {
  return audio.audibleTime(now - age * 1000) - startAt - correctionMs / 1000;
}
export class SingingPractice {
  constructor(practice) {
    this.practice = practice; this.q = practice.q; this.position = 0; this.paused = false; this.busy = false;
    this.microphone = new VocalMicrophone({ onState: state => this.micState(state) });
    this.warmup = new VocalWarmup(this);
    const q = this.q;
    const quick = document.createElement('div'); quick.className = 'singing-quick-controls';
    q('b-singing-mic-row').before(quick);
    quick.append(q('b-singing-mic-row'), q('b-vocal-volume-slot'), q('b-vocal-views'));
    q('b-vocal-volume-slot').append(q('b-singing-volume-label'));
    this.highway = new VocalHighway(q('b-vocal-highway-canvas'));
    this.preferredView = 'highway';
    try { if (localStorage.getItem('groove-vocal-view-v1') === 'lyrics') this.preferredView = 'lyrics'; } catch {}
    for (const button of q('b-vocal-views').querySelectorAll('[data-vocal-view]')) button.onclick = () => {
      this.preferredView = button.dataset.vocalView; this.setView(this.preferredView);
      try { localStorage.setItem('groove-vocal-view-v1', this.preferredView); } catch {}
    };
    q('b-singing-report').onclick=()=>{if(this.lastVocal)this.practice.onReport?.(this.lastVocal.record,this.lastVocal.report);};
    q('b-singing-settings').ontoggle = () => { if (!q('b-singing-settings').open) this.warmup.stop(); };
    q('b-vocal-mic').onclick = () => ['requesting', 'listening'].includes(this.microphone.state) ? this.microphone.stop() : this.microphone.start();
    q('b-singing-play').onclick = () => { if (!practice.session && !practice.expanded && !practice.rooms.room && window.matchMedia('(max-width:600px)').matches) practice.expand(); practice.attempt(() => practice.play()); };
    q('b-singing-back').onclick = () => practice.attempt(() => this.seek(this.lineStart(), true));
    q('b-singing-next').onclick = () => { const next = this.nextLine(); if (next) practice.attempt(() => this.seek(Math.max(0, next.time - 2), true)); };
    q('b-singing-seek').onchange = () => practice.attempt(() => this.seek(Number(q('b-singing-seek').value), !!practice.session));
    q('b-singing-seek').onpointerdown = () => { this.scrubbing = true; };
    q('b-singing-seek').onpointerup = q('b-singing-seek').onpointercancel = q('b-singing-seek').onblur = () => { this.scrubbing = false; };
    q('b-singing-expand').onclick = () => practice.expand();
    q('b-singing-click').onchange = () => { q('b-click').checked = q('b-singing-click').checked; };
    q('b-singing-volume').oninput = () => { q('b-volume').value = q('b-singing-volume').value; q('b-singing-volume-value').textContent = q('b-singing-volume').value + '%'; q('b-volume').oninput(); };
    try { const saved = localStorage.getItem('groove-vocal-extra-delay-v1'); if (saved !== null && Number.isFinite(Number(saved))) q('b-vocal-delay').value = String(Math.max(0, Math.min(300, Math.round(Number(saved) / 10) * 10))); } catch {}
    const saveDelay = () => {
      q('b-vocal-delay-label').textContent = q('b-vocal-delay').value + ' ms';
      try { localStorage.setItem('groove-vocal-extra-delay-v1', q('b-vocal-delay').value); } catch {}
    };
    q('b-vocal-delay').oninput = saveDelay;
    q('b-vocal-delay-reset').onclick = () => { q('b-vocal-delay').value = '0'; saveDelay(); };
    q('b-vocal-delay-label').textContent = q('b-vocal-delay').value + ' ms';
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.warmup.stop(); this.microphone.stop('off', 'Microphone off while this page is hidden. Tap Enable microphone when you return.'); } });
    window.addEventListener('pagehide', () => { this.warmup.stop(); this.microphone.stop(); });
  }
  reset() {
    this.lastVocal=null;this.q('b-singing-report').hidden=true;this.performanceState=null;
    this.generation = (this.generation || 0) + 1; this.position = 0; this.paused = false; this.busy = false;
    this.microphone.stop();
    const p = this.practice, q = this.q, vocals = p.active && p.part.instrument === 'vocals';
    document.body.classList.toggle('singing-mode', vocals); q('b-stage').classList.toggle('singing-stage', vocals);
    q('b-singing-title').textContent = p.arrangement.title; q('b-singing-volume').value = q('b-volume').value; q('b-singing-click').checked = q('b-click').checked;
    q('b-singing-volume-value').textContent = q('b-volume').value + '%'; this.liveVoice = { state: 'off', cents: null };
    q('b-vocal-mic').disabled = false;
    if (p.part.instrument === 'vocals' && !p.part.chart.notes.length) q('b-vocal-mic-status').textContent = 'Lyrics are ready. Use the key warm-up below, or ask your teacher to add the song’s vocal melody.';
    q('b-singing-settings').open = false; q('b-vocal-melody-panel').open = false;
    q('b-singing-error').hidden = true;
    this.warmup.reset();
    this.highway.reset(); this.setView(this.preferredView);
  }
  setView(view) {
    const hasMelody = this.practice.part.instrument === 'vocals' && this.practice.part.chart.notes.length > 0;
    this.view = hasMelody && view === 'highway' ? 'highway' : 'lyrics';
    this.q('b-lyrics-screen').dataset.view = this.view;
    this.q('b-vocal-highway').hidden = this.view !== 'highway';
    for (const button of this.q('b-vocal-views').querySelectorAll('[data-vocal-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.vocalView === this.view));
      button.disabled = button.dataset.vocalView === 'highway' && !hasMelody;
    }
  }
  time() { const p = this.practice; return p.session ? p.audio.audibleTime() - p.session.startAt : this.position; }
  lineStart() {
    const cues = this.practice.part.chart.lyrics || [], time = this.time();
    const cue = cues.find(cue => cue.time <= time && time < cue.end) || cues.findLast(cue => cue.time <= time) || cues[0];
    return Math.max(0, (cue?.time || 0) - 2);
  }
  nextLine() { return this.practice.part.chart.lyrics?.find(cue => cue.time > Math.max(0, this.time()) + .1); }
  async toggle() {
    const p = this.practice;
    this.warmup?.stop();
    if (p.session) { const time = this.time(); p.stop('Paused. Take a breath, then continue.'); this.position = Math.max(0, time); this.paused = true; return; }
    if (this.busy) return;
    if (p.school.user?.mustChangePassword) { p.school.openPassword(); return; }
    this.busy = true; const generation = this.generation, token = ++p.token;
    const errorNode = this.q?.('b-singing-error'); if (errorNode) errorNode.hidden = true;
    try {
      await p.prepareAudio();
      if (generation !== this.generation || token !== p.token || !p.active || p.part.instrument !== 'vocals' || p.rooms.room) return;
      const chart = p.part.chart, from = this.position >= chart.duration ? 0 : this.position;
      const countIn = this.paused ? 0 : chart.countInBeats * chart.countInBeatSeconds;
      p.begin(p.audio.context.currentTime + .15 + countIn - from, { from, skipCountIn: this.paused });
      this.position = from; this.paused = false;
    } catch (error) { if (generation === this.generation && errorNode) { errorNode.textContent = error.message || 'The song could not start. Try Play again.'; errorNode.hidden = false; } throw error; }
    finally { if (generation === this.generation) this.busy = false; }
  }
  async seek(time, play = false) {
    const p = this.practice; if (p.rooms.room || this.busy) return;
    p.stop(); this.position = Math.max(0, Math.min(p.part.chart.duration, time)); this.paused = !play;
    if (play) await this.toggle();
  }
  stopped() { this.position = 0; this.paused = false; }
  startAttempt(session) {
    if(session.part.instrument!=='vocals'||session.teacher||session.listen)return;
    session.vocalPerformance=new VocalPerformance(session.judge.chart,{from:session.from||0,anyOctave:this.q('b-vocal-range').value==='any',delayMs:Number(this.q('b-vocal-delay').value)});
    this.performanceState=null;
  }
  finishAttempt(session,time,completed=false) {
    const tracker=session?.vocalPerformance;if(!tracker)return;
    tracker.disconnect();const report=tracker.report(time,!completed),summary=vocalSummary(report);
    this.performanceState={report,summary};
    if(summary.measuredSeconds<.1||session.accountId!==(this.practice.school.user?.id||null))return;
    const p=this.practice,record={...vocalPracticeRecord(session.arrangement,{...session.part,chart:session.judge.chart},report,{id:crypto.randomUUID()}),report};
    session.vocalReport=report;this.lastVocal={record,report};p.lastReport={...session,runRecord:record,detail:report};
    this.q('b-singing-report').hidden=false;
    this.q('b-report').hidden=false;this.q('b-report-summary').textContent=Math.round(summary.accuracy)+'% on pitch · '+summary.measuredSeconds.toFixed(1)+' seconds measured';
    this.q('b-report-notes').textContent='Open your pitch report to see on-pitch phrases, low/high singing and quiet or unclear input.';
    this.q('b-retry-save').hidden=true;p.collapse();p.onAttempt?.(record,report);
    if(session.accountId&&p.school.user?.id===session.accountId&&['duet','school'].includes(record.sourceKind)){
      p.pendingResult={accountId:session.accountId,id:record.id,sourceKind:record.sourceKind,sourceId:record.sourceId,revisionId:record.revisionId,backingId:record.backingId,partId:record.partId,startBar:record.playbackStartBar,report};p.saveResult();
    }else this.q('b-save-state').textContent='Pitch report kept in this browser. Microphone audio was not recorded.';
    if(!document.hidden)p.onReport?.(record,report);
    return report;
  }
  drawPerformance(session,time) {
    const now=performance.now();if(this.performanceDrawAt&&now-this.performanceDrawAt<150)return;this.performanceDrawAt=now;
    const tracker=session?.vocalPerformance;
    const state=tracker?{report:tracker.report(time),summary:null}:this.performanceState;
    const summary=state?(state.summary||vocalSummary(state.report)):null,measured=summary?.measuredSeconds||0,active=this.microphone.state==='listening';
    this.q('b-vocal-accuracy').textContent=measured>=.1?Math.round(summary.accuracy)+'%':'—';
    const bar=this.q('b-vocal-accuracy-bar');bar.setAttribute('aria-valuenow',String(Math.round(summary?.accuracy||0)));bar.setAttribute('aria-valuetext',measured>=.1?Math.round(summary.accuracy)+' percent of measured vocal time on pitch':'No vocal time measured yet');
    this.q('b-vocal-accuracy-fill').style.height=(summary?.accuracy||0)+'%';
    this.q('b-vocal-accuracy-detail').textContent=measured>=.1?measured.toFixed(1)+'s measured':!this.practice.part.chart.notes.length?'No melody':active?'Sing to begin':'Mic off';
  }
  syncMicContext() {
    const room = this.practice.rooms.room?.id || '';
    if (this.micRoom === room) return;
    this.micRoom = room; this.micState(this.microphone);
  }
  micState({ state, message }) {
    if(state!=='listening')this.practice.session?.vocalPerformance?.disconnect();
    const q = this.q, on = state === 'listening', pending = state === 'requesting';
    q('b-vocal-latency').textContent = on ? 'Input delay: ' + Math.round(this.microphone.inputLatency * 1000) + ' ms (' + (this.microphone.latencyReported ? 'browser reported' : 'estimate; this browser does not report it') + '). Extra delay is added for scoring and the recorded trail.' : 'Enable the mic to check its input delay.';
    q('b-vocal-mic').textContent = on ? 'Turn microphone off' : pending ? 'Cancel microphone' : 'Enable microphone';
    q('b-vocal-mic').setAttribute('aria-pressed', String(on)); q('b-vocal-mic-badge').textContent = on ? '● MIC ON' : pending ? 'WAITING' : 'MIC OFF';
    q('b-vocal-mic-badge').dataset.on = String(on); q('b-vocal-mic-status').textContent = state === 'off' && message === 'Your microphone is off.' ? 'Optional pitch feedback. Your voice stays on this device.' : message;
    if (this.practice.rooms.room && (on || state === 'off')) q('b-vocal-mic-status').textContent = 'Audio stays on your phone. When the mic is on, live pitch guidance is shared with your teacher in this jam.';
  }
  draw(chart, time, playing) {
    const p = this.practice, q = this.q, room = !!p.rooms.room;
    q('b-singing-report').hidden=playing||!this.lastVocal;
    q('b-singing-play').textContent = this.busy ? 'Loading song…' : playing ? (this.microphone.state==='listening'?'Ⅱ Pause & report':'Ⅱ Pause') : this.paused ? '▶ Continue' : '▶ Play song';
    for (const id of ['b-singing-play', 'b-singing-back', 'b-singing-seek']) q(id).disabled = room || this.busy;
    const next = this.nextLine(); q('b-singing-next').disabled = room || this.busy || !next;
    q('b-singing-room').hidden = !room; q('b-singing-volume-label').hidden = room || !(p.backing || p.arrangement.audio);
    q('b-singing-click').checked = q('b-click').checked;
    const position = Math.min(chart.duration, Math.max(0, time));
    q('b-singing-seek').max = chart.duration;
    if (!this.scrubbing) q('b-singing-seek').value = position;
    q('b-singing-time').textContent = singingTime(this.scrubbing ? Number(q('b-singing-seek').value) : position) + ' / ' + singingTime(chart.duration);
    const detected = this.microphone.sample();
    this.warmup.draw(detected);
    const age = detected?.age ?? this.microphone.sampleAge?.() ?? 0;
    const correction = Number(q('b-vocal-delay').value) / 1000;
    const effectiveTime = playing && p.session ? vocalCaptureTime(p.audio, p.session.startAt, age, correction * 1000) : time - age - correction;
    let feedback;
    if (!chart.notes.length) feedback = vocalPitchFeedback(null, [], time);
    else if (this.warmup.running || this.warmup.finding || this.warmup.busy) feedback = { state: 'ready', label: 'Warming up', hint: 'Follow the Listen / Your turn exercise below.', target: '—', heard: '—', cents: null };
    else if (this.microphone.state !== 'listening') {
      const target = vocalTarget(chart.notes, time), note = target.active[0] || target.next;
      feedback = { state: 'off', label: 'Sing with the lyrics', hint: 'Enable your microphone for a live pitch guide.', target: note ? pitchName(note.pitch) : '—', heard: '—', cents: null };
    }
    else if (!playing) feedback = { state: 'ready', label: 'Your mic is ready', hint: 'Press Play and sing along. Your voice stays on this device.', target: '—', heard: '—', cents: null };
    else feedback = vocalPitchFeedback(detected, chart.notes, time < (p.session?.from || 0) ? -1 : effectiveTime, { anyOctave: q('b-vocal-range').value === 'any' });
    p.session?.vocalPerformance?.observe(effectiveTime,detected,playing&&this.microphone.state==='listening'&&!this.warmup.running&&!this.warmup.finding&&!this.warmup.busy);
    this.drawPerformance(p.session,time);
    q('b-vocal-pitch').dataset.state = feedback.state;
    for (const [id, value] of [['b-pitch-feedback', feedback.label], ['b-pitch-hint', feedback.hint], ['b-pitch-wanted', feedback.target], ['b-pitch-heard', feedback.heard]]) if (q(id).textContent !== value) q(id).textContent = value;
    const dot = q('b-pitch-dot'); dot.hidden = feedback.cents === null; if (!dot.hidden) dot.style.left = (50 + Math.max(-1, Math.min(1, feedback.cents / 150)) * 46) + '%';
    this.liveVoice = { state: this.microphone.state === 'listening' ? feedback.state : 'off', cents: Number.isFinite(feedback.cents) ? feedback.cents : null };
    const side = q('b-vocal-side-meter'); side.dataset.state = feedback.state;
    for (const [id, value] of [['b-vocal-side-label', voiceStatusLabel(this.liveVoice.state)], ['b-vocal-side-target', feedback.target], ['b-vocal-side-heard', feedback.heard]]) if (q(id).textContent !== value) q(id).textContent = value;
    const sideDot = q('b-vocal-side-dot'); sideDot.hidden = !Number.isFinite(feedback.cents); if (!sideDot.hidden) sideDot.style.bottom = (50 + Math.max(-1, Math.min(1, feedback.cents / 150)) * 42) + '%';
    if (this.view === 'highway') this.highway.draw(chart, time, {
      shift: Number(q('b-vocal-guide-octave').value), feedback, playing,
      sampleTime: effectiveTime,
    });
  }
}
