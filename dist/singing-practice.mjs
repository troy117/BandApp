import { VocalMicrophone } from './vocal-microphone.mjs';
import { vocalPitchFeedback } from './vocal-pitch.mjs';
import { vocalTarget } from './vocal-guide.mjs';
import { pitchName } from './instruments.mjs';

export function singingMarkup() {
  return `<div id="b-lyrics-screen" class="band-lyrics" hidden>
    <header class="singing-heading"><div><p class="eyebrow">YOUR VOICE. YOUR PACE.</p><h3 id="b-singing-title">Singing practice</h3></div><button id="b-singing-expand" class="button secondary" aria-label="Expand singing practice" title="Full screen">Focus view</button></header>
    <div class="singing-mic-row"><button id="b-vocal-mic" class="button secondary" aria-pressed="false">Enable microphone</button><span id="b-vocal-mic-badge">MIC OFF</span></div>
    <p id="b-vocal-mic-status" class="singing-mic-status" role="status">Optional pitch feedback. Your voice stays on this device.</p>
    <div class="singing-words"><p id="b-vocal-state">READY TO SING</p><div id="b-vocal-line" aria-live="polite"></div><progress id="b-vocal-progress" max="1" value="0" aria-label="Current lyric line progress"></progress><p id="b-vocal-next"></p></div>
    <section id="b-vocal-pitch" class="singing-pitch" aria-label="Live pitch guide" data-state="off">
      <div class="singing-note-pair"><div><span>Target</span><strong id="b-pitch-wanted">—</strong></div><strong id="b-pitch-feedback" role="status" aria-live="polite">Sing with the lyrics</strong><div><span>You</span><strong id="b-pitch-heard">—</strong></div></div>
      <div class="singing-meter" aria-hidden="true"><span class="singing-center"></span><span id="b-pitch-dot" hidden></span></div><div class="singing-meter-labels" aria-hidden="true"><span>Too low</span><span>On pitch</span><span>Too high</span></div><p id="b-pitch-hint">Enable your microphone when you’re ready for pitch feedback.</p>
    </section>
    <div class="singing-player"><p id="b-singing-error" class="singing-play-error" role="alert" hidden></p><label class="singing-seek-label" for="b-singing-seek">Song position <span id="b-singing-time">0:00 / 0:00</span></label><input id="b-singing-seek" type="range" min="0" max="1" step="0.1" value="0"><div class="singing-player-buttons"><button id="b-singing-back" class="button secondary" aria-label="Practice this lyric line again">↶ Try line again</button><button id="b-singing-play" class="button primary">▶ Play song</button></div><button id="b-singing-next" class="text-button">Skip to next vocal line →</button><p id="b-singing-room" class="band-help" hidden>Your teacher controls playback in this session.</p></div>
    <details id="b-singing-settings" class="singing-details"><summary>Sound &amp; pitch settings</summary><p class="band-help">Use headphones and keep your phone nearby. One voice works best. Live guidance is for practice; it isn’t saved as a grade.</p><label class="band-check"><input id="b-singing-click" type="checkbox" checked>Metronome</label><label class="singing-setting" id="b-singing-volume-label">Music volume<input id="b-singing-volume" type="range" min="0" max="100" value="65"></label><label class="singing-setting">Singing range<select id="b-vocal-range"><option value="any">My comfortable octave</option><option value="exact">Exact written octave</option></select></label><p class="band-help">Comfortable octave follows the same melody higher or lower, so you can sing in your own range.</p><label class="singing-setting">Microphone timing correction <span id="b-vocal-delay-label">80 ms</span><input id="b-vocal-delay" type="range" min="0" max="300" step="10" value="80"></label><p class="band-help">If feedback changes before you reach the next note, increase this slightly. Headphones with a cable usually have less delay than Bluetooth.</p></details>
    <details id="b-vocal-melody-panel" class="singing-details" hidden><summary>Melody &amp; sheet music</summary><div class="band-row"><p id="b-vocal-target"></p><label class="band-check"><input id="b-vocal-guide-enabled" type="checkbox">Hear melody guide</label></div><canvas id="b-vocal-melody" aria-label="Vocal melody on a treble staff with note names and hold lengths"></canvas><p class="band-help">Follow the green line. Shaded tails show how long to hold. Headphones keep the guide out of your microphone.</p></details>
  </div>`;
}

const singingTime = value => Math.floor(Math.max(0, value) / 60) + ':' + String(Math.floor(Math.max(0, value)) % 60).padStart(2, '0');
export class SingingPractice {
  constructor(practice) {
    this.practice = practice; this.q = practice.q; this.position = 0; this.paused = false; this.busy = false;
    this.microphone = new VocalMicrophone({ onState: state => this.micState(state) });
    const q = this.q;
    q('b-vocal-mic').onclick = () => ['requesting', 'listening'].includes(this.microphone.state) ? this.microphone.stop() : this.microphone.start();
    q('b-singing-play').onclick = () => { if (!practice.session && !practice.expanded && !practice.rooms.room && window.matchMedia('(max-width:600px)').matches) practice.expand(); practice.attempt(() => practice.play()); };
    q('b-singing-back').onclick = () => practice.attempt(() => this.seek(this.lineStart(), true));
    q('b-singing-next').onclick = () => { const next = this.nextLine(); if (next) practice.attempt(() => this.seek(Math.max(0, next.time - 2), true)); };
    q('b-singing-seek').onchange = () => practice.attempt(() => this.seek(Number(q('b-singing-seek').value), !!practice.session));
    q('b-singing-seek').onpointerdown = () => { this.scrubbing = true; };
    q('b-singing-seek').onpointerup = q('b-singing-seek').onpointercancel = q('b-singing-seek').onblur = () => { this.scrubbing = false; };
    q('b-singing-expand').onclick = () => practice.expand();
    q('b-singing-click').onchange = () => { q('b-click').checked = q('b-singing-click').checked; };
    q('b-singing-volume').oninput = () => { q('b-volume').value = q('b-singing-volume').value; q('b-volume').oninput(); };
    q('b-vocal-delay').oninput = () => { q('b-vocal-delay-label').textContent = q('b-vocal-delay').value + ' ms'; };
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.microphone.stop('off', 'Microphone off while this page is hidden. Tap Enable microphone when you return.'); });
    window.addEventListener('pagehide', () => this.microphone.stop());
  }
  reset() {
    this.generation = (this.generation || 0) + 1; this.position = 0; this.paused = false; this.busy = false;
    this.microphone.stop();
    const p = this.practice, q = this.q, vocals = p.active && p.part.instrument === 'vocals';
    document.body.classList.toggle('singing-mode', vocals); q('b-stage').classList.toggle('singing-stage', vocals);
    q('b-singing-title').textContent = p.arrangement.title; q('b-singing-volume').value = q('b-volume').value; q('b-singing-click').checked = q('b-click').checked;
    q('b-vocal-mic').disabled = !p.part.chart.notes.length;
    if (p.part.instrument === 'vocals' && !p.part.chart.notes.length) q('b-vocal-mic-status').textContent = 'Lyrics are ready. Your teacher can add a vocal melody for pitch feedback.';
    q('b-singing-settings').open = false; q('b-vocal-melody-panel').open = false;
    q('b-singing-error').hidden = true;
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
  micState({ state, message }) {
    const q = this.q, on = state === 'listening', pending = state === 'requesting';
    q('b-vocal-mic').textContent = on ? 'Turn microphone off' : pending ? 'Cancel microphone' : 'Enable microphone';
    q('b-vocal-mic').setAttribute('aria-pressed', String(on)); q('b-vocal-mic-badge').textContent = on ? '● MIC ON' : pending ? 'WAITING' : 'MIC OFF';
    q('b-vocal-mic-badge').dataset.on = String(on); q('b-vocal-mic-status').textContent = state === 'off' && message === 'Your microphone is off.' ? 'Optional pitch feedback. Your voice stays on this device.' : message;
  }
  draw(chart, time, playing) {
    const p = this.practice, q = this.q, room = !!p.rooms.room;
    q('b-singing-play').textContent = this.busy ? 'Loading song…' : playing ? 'Ⅱ Pause' : this.paused ? '▶ Continue' : '▶ Play song';
    for (const id of ['b-singing-play', 'b-singing-back', 'b-singing-seek']) q(id).disabled = room || this.busy;
    const next = this.nextLine(); q('b-singing-next').disabled = room || this.busy || !next;
    q('b-singing-room').hidden = !room; q('b-singing-volume-label').hidden = room || !(p.backing || p.arrangement.audio);
    q('b-singing-click').checked = q('b-click').checked;
    const position = Math.min(chart.duration, Math.max(0, time));
    q('b-singing-seek').max = chart.duration;
    if (!this.scrubbing) q('b-singing-seek').value = position;
    q('b-singing-time').textContent = singingTime(this.scrubbing ? Number(q('b-singing-seek').value) : position) + ' / ' + singingTime(chart.duration);
    const detected = this.microphone.sample();
    let feedback;
    if (!chart.notes.length) feedback = vocalPitchFeedback(null, [], time);
    else if (this.microphone.state !== 'listening') {
      const target = vocalTarget(chart.notes, time), note = target.active[0] || target.next;
      feedback = { state: 'off', label: 'Sing with the lyrics', hint: 'Enable your microphone for a live pitch guide.', target: note ? pitchName(note.pitch) : '—', heard: '—', cents: null };
    }
    else if (!playing) feedback = { state: 'ready', label: 'Your mic is ready', hint: 'Press Play and sing along. Your voice stays on this device.', target: '—', heard: '—', cents: null };
    else feedback = vocalPitchFeedback(detected, chart.notes, time < (p.session?.from || 0) ? -1 : time - (detected?.age || 0) - Number(q('b-vocal-delay').value) / 1000, { anyOctave: q('b-vocal-range').value === 'any' });
    q('b-vocal-pitch').dataset.state = feedback.state;
    for (const [id, value] of [['b-pitch-feedback', feedback.label], ['b-pitch-hint', feedback.hint], ['b-pitch-wanted', feedback.target], ['b-pitch-heard', feedback.heard]]) if (q(id).textContent !== value) q(id).textContent = value;
    const dot = q('b-pitch-dot'); dot.hidden = feedback.cents === null; if (!dot.hidden) dot.style.left = (50 + Math.max(-1, Math.min(1, feedback.cents / 150)) * 46) + '%';
  }
}
