import { pitchName } from './instruments.mjs';
import { vocalPitchFeedback } from './vocal-pitch.mjs';

export const WARMUP_REFERENCE_SECONDS = 4;
export const WARMUP_RESPONSE_AT = 4.3;
export const WARMUP_STEP_SECONDS = 8.3;

export function warmupMeterFrame(feedback) {
  const cents = Number.isFinite(feedback?.cents) ? feedback.cents : null;
  return { state: feedback?.state || 'ready', heard: feedback?.heard || '—', cents, position: cents === null ? null : 50 + Math.max(-1, Math.min(1, cents / 150)) * 46 };
}

export function warmupNotes(notes, { exercise = 'song', root = 0, minor = false, shift = 0 } = {}) {
  if (exercise === 'song') {
    const opening = [];
    for (const note of notes) { if (opening.at(-1) !== note.pitch) opening.push(note.pitch); if (opening.length === 5) break; }
    return opening.map(pitch => pitch + shift);
  }
  const tonic = 60 + Number(root) + shift;
  return (minor ? [0, 2, 3, 5, 7, 5, 3, 2, 0] : [0, 2, 4, 5, 7, 5, 4, 2, 0]).map(interval => tonic + interval);
}

export function comfortableOctave(observations, reference) {
  const clean = observations.filter(item => Number.isFinite(item.midi) && item.confidence >= .9 && !item.clipped);
  if (clean.length < 15 || clean.at(-1).at - clean[0].at < 1.4) return null;
  const values = clean.map(item => item.midi).sort((a, b) => a - b), middle = values[Math.floor(values.length / 2)];
  const central = values.filter(value => Math.abs(value - middle) < .6);
  if (central.length < clean.length * .8) return null;
  return { heard: Math.round(middle), shift: Math.max(-24, Math.min(24, 12 * Math.round((middle - reference) / 12))) };
}

export function warmupMarkup() {
  return `<section class="vocal-warmup" aria-labelledby="b-warmup-title"><h4 id="b-warmup-title">Warm up your voice</h4><p class="band-help">Listen, then gently echo each note on “ah.” Stay in a range that feels easy.</p><label class="singing-setting">Exercise<select id="b-warmup-exercise"><option value="song">Opening vocal melody</option><option value="major">Major key · five-note scale</option><option value="minor">Minor key · five-note scale</option></select></label><div class="warmup-registers"><label class="singing-setting" id="b-warmup-key-label" hidden>Practice key<select id="b-warmup-key">${['C','C♯ / D♭','D','D♯ / E♭','E','F','F♯ / G♭','G','G♯ / A♭','A','A♯ / B♭','B'].map((name,i)=>'<option value="'+i+'">'+name+'</option>').join('')}</select></label><label class="singing-setting">Warm-up octave<select id="b-warmup-octave"><option value="-24">Two octaves lower</option><option value="-12">One octave lower</option><option value="0" selected>Original octave</option><option value="12">One octave higher</option><option value="24">Two octaves higher</option></select></label></div><p id="b-warmup-notes" class="warmup-note-list"></p><div class="warmup-actions"><button id="b-warmup-start" class="button secondary">▶ Start warm-up</button><button id="b-warmup-find" class="button secondary">Find a comfortable octave</button></div><div class="warmup-readout" id="b-warmup-meter" data-state="ready"><span id="b-warmup-phase">LISTEN → SING</span><div class="warmup-note-pair"><div><span>Target</span><strong id="b-warmup-target">—</strong></div><div><span>You</span><strong id="b-warmup-heard">—</strong></div></div><p id="b-warmup-feedback" role="status">Choose a melody or key, then start.</p><div id="b-warmup-track" class="singing-meter" role="img" aria-label="Warm-up pitch relative to target" aria-valuemin="-150" aria-valuemax="150" aria-valuetext="Pitch matching starts on your singing turn."><span class="singing-center"></span><span id="b-warmup-dot" class="pitch-indicator" hidden></span></div><div class="singing-meter-labels" aria-hidden="true"><span>Too low</span><span>On pitch</span><span>Too high</span></div></div><p id="b-warmup-help" class="band-help">Opening melody uses your song’s notes. For scale practice, choose the key you want to work on.</p><p id="b-warmup-suggestion" class="band-help"></p><button id="b-warmup-apply" class="button secondary" hidden>Use this octave</button><p class="band-help">Use headphones. Listen to the four-second tone, then sing for four seconds. The meter starts on your turn. An octave suggestion is a starting point—your comfort decides.</p></section>`;
}

const warmupText = (element, value) => { if (element.textContent !== value) element.textContent = value; };

export class VocalWarmup {
  constructor(singing) {
    this.singing = singing; this.practice = singing.practice; this.q = singing.q; this.generation = 0; this.stop();
    const q = this.q;
    q('b-warmup-start').onclick = () => this.running || this.finding || this.busy ? this.stop() : this.practice.attempt(() => this.start());
    q('b-warmup-find').onclick = () => this.practice.attempt(() => this.start(true));
    for (const id of ['b-warmup-exercise','b-warmup-key','b-warmup-octave']) q(id).onchange = () => { this.stop(); this.renderChoices(); };
    q('b-warmup-apply').onclick = () => { if (!this.suggestion) return; q('b-warmup-octave').value = this.suggestion.shift; q('b-vocal-guide-octave').value = this.suggestion.shift; q('b-vocal-range').value = 'any'; this.practice.piano.clear(); this.renderChoices(); q('b-warmup-suggestion').textContent += ' Applied to warm-up and melody-guide sound.'; q('b-warmup-apply').hidden = true; };
  }
  choices() { return { exercise: this.q('b-warmup-exercise').value === 'song' ? 'song' : 'scale', root: Number(this.q('b-warmup-key').value), minor: this.q('b-warmup-exercise').value === 'minor', shift: Number(this.q('b-warmup-octave').value) }; }
  renderChoices() {
    const q = this.q, chart = this.practice.part.chart, song = q('b-warmup-exercise').value === 'song';
    q('b-warmup-exercise').querySelector('option[value="song"]').disabled = !chart.notes.length;
    if (!chart.notes.length && song) q('b-warmup-exercise').value = 'major';
    q('b-warmup-key-label').hidden = q('b-warmup-exercise').value === 'song';
    const notes = warmupNotes(chart.notes, this.choices()); q('b-warmup-notes').textContent = notes.map(pitchName).join(' · ');
    warmupText(q('b-warmup-target'), notes.length ? pitchName(notes[0]) : '—');
  }
  reset() { this.stop(); this.suggestion = null; this.q('b-warmup-octave').value = '0'; this.q('b-vocal-guide-octave').value = '0'; this.q('b-warmup-suggestion').textContent = ''; this.q('b-warmup-apply').hidden = true; this.q('b-warmup-phase').textContent = 'LISTEN → SING'; this.q('b-warmup-feedback').textContent = 'Choose a melody or key, then start.'; this.q('b-warmup-help').textContent = 'Opening melody uses your song’s notes. For scale practice, choose the key you want to work on.'; this.renderChoices(); }
  stop() {
    const active = this.running || this.finding || this.busy;
    if (this.busy && this.singing.microphone.state === 'requesting') this.singing.microphone.stop();
    this.generation++; this.running = this.finding = this.busy = false; this.practice.piano.off('vocal-warmup');
    if (this.q('b-warmup-start')) this.q('b-warmup-start').textContent = '▶ Start warm-up';
    this.drawMeter();
    if (active) { this.q('b-warmup-phase').textContent = 'WARM-UP STOPPED'; this.q('b-warmup-feedback').textContent = 'Start again when you’re ready.'; }
  }
  drawMeter(feedback) {
    const q = this.q, frame = warmupMeterFrame(feedback), meter = q('b-warmup-meter');
    if (!meter) return;
    meter.dataset.state = frame.state;
    warmupText(q('b-warmup-heard'), frame.heard);
    const dot = q('b-warmup-dot'); dot.hidden = frame.position === null;
    if (frame.position !== null) dot.style.left = frame.position + '%';
    const track = q('b-warmup-track');
    track.setAttribute('role', frame.cents === null ? 'img' : 'meter');
    if (frame.cents === null) track.removeAttribute('aria-valuenow');
    else track.setAttribute('aria-valuenow', String(Math.round(Math.max(-150, Math.min(150, frame.cents)))));
    track.setAttribute('aria-valuetext', frame.cents === null ? 'Pitch matching starts on your singing turn.' : feedback.label + ' · ' + Math.abs(Math.round(frame.cents)) + ' cents from target');
  }
  async start(finding = false) {
    if (this.practice.rooms.room) { this.q('b-warmup-help').textContent = 'Leave the jam session to warm up at your own pace.'; return; }
    this.practice.stop(); this.stop(); const generation = this.generation; this.busy = true;
    const sequence = warmupNotes(this.practice.part.chart.notes, this.choices());
    if (!finding && (!sequence.length || sequence.some(pitch => pitch < 33 || pitch > 88))) { this.busy = false; this.q('b-warmup-feedback').textContent = 'Choose an octave nearer the middle for the microphone guide.'; return; }
    this.q('b-warmup-start').textContent = 'Cancel warm-up';
    this.q('b-warmup-feedback').textContent = 'Getting your microphone and sound ready…';
    try {
      await Promise.all([this.practice.audio.ready(), this.singing.microphone.start()]);
      if (generation !== this.generation || this.practice.part.instrument !== 'vocals') return;
      // Acquiring a phone microphone can change the audio route after output was unlocked.
      await this.practice.audio.ready(); if (generation !== this.generation) return;
      if (finding && this.singing.microphone.state !== 'listening') { this.q('b-warmup-feedback').textContent = 'Enable the microphone to find an octave. You can still warm up by ear.'; return; }
      this.sequence = sequence; this.running = !finding; this.finding = finding; this.observations = []; this.lastObservation = -Infinity; this.step = -1; this.matches = new Set(); this.measuredSteps = new Set(); this.held = 0; this.started = this.practice.audio.context.currentTime; this.lastAt = this.started;
      this.q('b-warmup-suggestion').textContent = ''; this.q('b-warmup-apply').hidden = true;
    } catch (error) { if (generation === this.generation) { this.stop(); this.q('b-warmup-feedback').textContent = error.message || 'Sound could not start. Try the warm-up again.'; } throw error; }
    finally { if (generation === this.generation) this.busy = false; }
  }
  draw(detection) {
    const q = this.q, p = this.practice, room = !!p.rooms.room;
    if (this.roomShown !== room) { this.roomShown = room; q('b-warmup-help').textContent = room ? 'Leave the jam session to warm up at your own pace.' : 'Opening melody uses your song’s notes. For scale practice, choose the key you want to work on.'; }
    q('b-warmup-start').disabled = room; q('b-warmup-find').disabled = room || this.busy;
    q('b-warmup-find').disabled ||= this.running || this.finding;
    for (const id of ['b-warmup-exercise','b-warmup-key','b-warmup-octave']) q(id).disabled = this.running || this.finding || this.busy;
    if (!this.running && !this.finding) return;
    if (this.singing.microphone.state !== 'listening' && this.finding) { this.stop(); warmupText(q('b-warmup-feedback'), 'Microphone off. Enable it and try again.'); return; }
    const now = p.audio.context?.currentTime;
    if (!Number.isFinite(now) || p.audio.context.state !== 'running') { this.stop(); warmupText(q('b-warmup-feedback'), 'Sound was interrupted. Start the warm-up again.'); return; }
    q('b-warmup-start').textContent = '■ Stop warm-up';
    if (this.finding) {
      this.drawMeter({ heard: detection ? pitchName(Math.round(detection.midi)) : '—' });
      warmupText(q('b-warmup-phase'), 'YOUR COMFORTABLE VOICE'); warmupText(q('b-warmup-target'), '—');
      warmupText(q('b-warmup-feedback'), 'Sing an easy, steady “ah” for a few seconds. No high or low stretching.');
      if (detection && now - (this.lastObservation || -Infinity) > .06) { this.observations.push({ ...detection, at: now }); this.lastObservation = now; }
      this.observations = this.observations.filter(item => now - item.at < 2.5);
      const notes = warmupNotes(p.part.chart.notes, { ...this.choices(), shift: 0 }), reference = notes[Math.floor(notes.length / 2)] || 60;
      const suggestion = comfortableOctave(this.observations, reference);
      if (suggestion || now - this.started > 8) {
        this.stop(); warmupText(q('b-warmup-phase'), suggestion ? 'TRY THIS OCTAVE' : 'TRY AGAIN');
        if (!suggestion) { warmupText(q('b-warmup-feedback'), 'No steady note found. Move closer, lower the background sound and try again.'); return; }
        this.suggestion = suggestion;
        this.drawMeter({ heard: pitchName(suggestion.heard) });
        const shifted = warmupNotes(p.part.chart.notes, { ...this.choices(), shift: suggestion.shift });
        warmupText(q('b-warmup-feedback'), 'Heard a steady ' + pitchName(suggestion.heard) + '.');
        q('b-warmup-suggestion').textContent = 'Try ' + (suggestion.shift === 0 ? 'the original octave' : Math.abs(suggestion.shift / 12) + ' octave' + (Math.abs(suggestion.shift) === 24 ? 's' : '') + (suggestion.shift < 0 ? ' lower' : ' higher')) + ': ' + shifted.map(pitchName).join(' · ') + '. Keep the version that feels easy.';
        q('b-warmup-apply').hidden = false;
      }
      return;
    }
    const elapsed = now - this.started, step = Math.floor(elapsed / WARMUP_STEP_SECONDS), phase = elapsed % WARMUP_STEP_SECONDS;
    if (step >= this.sequence.length) { this.stop(); warmupText(q('b-warmup-phase'), 'WARM-UP COMPLETE'); warmupText(q('b-warmup-feedback'), this.measuredSteps.size ? this.matches.size + ' of ' + this.measuredSteps.size + ' measured notes held near the target. Repeat gently, or return to your song.' : 'Warm-up completed by ear. Pitch wasn’t measured while the microphone was off.'); return; }
    if (step !== this.step) { this.step = step; this.held = 0; p.piano.on('vocal-warmup', this.sequence[step], .65, now, { sustain: true }); p.piano.off('vocal-warmup', now + WARMUP_REFERENCE_SECONDS); }
    warmupText(q('b-warmup-target'), pitchName(this.sequence[step]));
    if (phase < WARMUP_RESPONSE_AT) {
      this.drawMeter();
      warmupText(q('b-warmup-phase'), (phase < WARMUP_REFERENCE_SECONDS ? 'LISTEN · ' + Math.ceil(WARMUP_REFERENCE_SECONDS - phase) + 's' : 'GET READY') + ' · ' + (step + 1) + ' / ' + this.sequence.length);
      warmupText(q('b-warmup-feedback'), phase < WARMUP_REFERENCE_SECONDS ? 'Listen for four seconds. Your singing turn is next.' : 'Take a breath, then match the note.');
    }
    else {
      if (this.singing.microphone.state === 'listening') this.measuredSteps.add(step);
      warmupText(q('b-warmup-phase'), 'YOUR TURN · ' + Math.ceil(WARMUP_STEP_SECONDS - phase) + 's · ' + (step + 1) + ' / ' + this.sequence.length);
      const feedback = vocalPitchFeedback(detection, [{ pitch: this.sequence[step], time: 0, duration: 5 }], 2, { anyOctave: false });
      if (feedback.state === 'on-pitch') this.held += Math.min(.1, now - this.lastAt); else this.held = 0;
      if (this.held >= .7) this.matches.add(step);
      this.drawMeter(this.singing.microphone.state === 'listening' ? feedback : null);
      warmupText(q('b-warmup-feedback'), this.singing.microphone.state !== 'listening' ? 'Echo the note by ear, or enable your microphone.' : this.matches.has(step) && feedback.state === 'on-pitch' ? 'Nice steady note. Keep it easy.' : feedback.label);
    }
    this.lastAt = now;
  }
}
