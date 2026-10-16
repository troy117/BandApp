import { alignMidiChart, fitAlignment, midiPositionTime, audioOnsets, suggestAlignment, validateAlignment } from './sync.mjs';
import { makeMidiChart } from './midi.mjs';

export class AudioSync {
  constructor(owner) {
    this.owner = owner; this.el = owner.el; this.features = null; this.featureBuffer = null; this.candidates = []; this.preview = false;
    this.el('suggest-sync').addEventListener('click', () => this.analyze());
    this.el('sync-candidates').addEventListener('click', event => { const button = event.target.closest('[data-sync]'); if (button) { try { this.set(this.candidates[Number(button.dataset.sync)]); } catch (error) { this.status(error.message); } } });
    this.el('match-sync').addEventListener('click', () => this.match());
    this.el('sync-second').addEventListener('change', () => { this.el('sync-second-fields').hidden = !this.el('sync-second').checked; });
    this.el('midi-speed').addEventListener('change', () => {
      try { this.set({ offset: this.owner.draft.offset, timeScale: 100 / Number(this.el('midi-speed').value) }); }
      catch (error) { this.status(error.message); this.owner.message(error.message, true); this.render(); }
    });
    for (const direction of ['earlier', 'later']) this.el(`audio-${direction}`).addEventListener('click', () => {
      try { this.set({ offset: Math.round((this.owner.draft.offset + (direction === 'earlier' ? -0.05 : 0.05)) * 1000) / 1000, timeScale: this.owner.draft.timeScale ?? 1 }); }
      catch (error) { this.status(error.message); }
    });
    this.el('preview-audio').addEventListener('click', () => this.play(false));
    this.el('preview-sync').addEventListener('click', () => this.play(true));
    this.el('stop-sync').addEventListener('click', () => this.stop());
    for (const id of ['sync-audio', 'sync-bar', 'sync-beat']) this.el(id).addEventListener('input', () => { this.stop(); this.draw(); });
    this.el('sync-waveform').addEventListener('click', event => {
      if (!this.owner.draft?.buffer || this.owner.busy) return;
      const rect = this.el('sync-waveform').getBoundingClientRect();
      this.el('sync-audio').value = Math.max(0, Math.min(this.owner.draft.buffer.duration - 0.001, this.waveStart + (event.clientX - rect.left) / rect.width * this.waveLength)).toFixed(3);
      this.stop(); this.draw();
    });
    this.el('sync-zoom').addEventListener('change', () => this.draw());
    this.el('audio-sync').addEventListener('toggle', () => { if (this.el('audio-sync').open) this.draw(); });
    this.owner.dialog.addEventListener('close', () => this.stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    window.addEventListener('blur', () => this.stop());
    window.addEventListener('resize', () => this.draw());
  }
  base() { const d = this.owner.draft; return makeMidiChart(d.song, d.selected, d.mapping); }
  status(text) { this.el('sync-status').textContent = text; }
  reset() {
    this.stop(); this.candidates = []; this.features = null; this.featureBuffer = null;
    this.el('sync-candidates').innerHTML = ''; this.status(''); this.el('sync-second').checked = false; this.el('sync-second-fields').hidden = true;
    const d = this.owner.draft;
    if (!d) return;
    try {
      const chart = this.base(), first = chart.notes[0];
      this.el('sync-bar').value = first.bar; this.el('sync-beat').value = Number(first.beat.toFixed(4));
      this.el('sync-audio').value = Math.max(0, first.time * (d.timeScale ?? 1) - d.offset).toFixed(3);
      this.el('sync-bar-2').value = Math.min(chart.bars, Math.max(first.bar + 4, Math.floor(chart.bars * 0.7))); this.el('sync-beat-2').value = 1; this.el('sync-audio-2').value = '';
    } catch { /* Mapping may still need a selection. */ }
  }
  render() {
    const d = this.owner.draft, disabled = !d?.buffer || this.owner.busy;
    this.el('audio-sync').hidden = !d?.buffer;
    for (const element of this.el('audio-sync').querySelectorAll('button,input,select')) element.disabled = disabled;
    this.el('midi-speed').disabled = !d || this.owner.busy;
    this.el('midi-speed').value = Number((100 / (d?.timeScale ?? 1)).toFixed(3));
    this.el('stop-sync').disabled = !this.preview;
    this.el('sync-summary').textContent = d ? `Current match: ${d.offset.toFixed(3)} s offset · ${(100 / (d.timeScale ?? 1)).toFixed(2)}% MIDI speed. Recording pitch and speed stay unchanged.` : '';
    for (const id of ['sync-bar', 'sync-bar-2']) this.el(id).max = d ? this.baseSafeBars() : 1;
    if (d?.buffer) for (const id of ['sync-audio', 'sync-audio-2']) this.el(id).max = d.buffer.duration.toFixed(3);
    this.draw();
  }
  baseSafeBars() { try { return this.base().bars; } catch { return 1; } }
  set(alignment) {
    if (!this.owner.draft) return;
    validateAlignment(alignment.offset, alignment.timeScale);
    alignMidiChart(this.base(), alignment.timeScale);
    if (this.owner.draft.buffer && alignment.offset <= -this.owner.draft.buffer.duration) throw new Error('That offset skips the whole recording.');
    this.stop(); Object.assign(this.owner.draft, { offset: alignment.offset, timeScale: alignment.timeScale });
    this.owner.render(); this.status('Match updated. Preview together near the start, then check a later bar before saving.');
  }
  match() {
    try {
      const chart = this.base(), buffer = this.owner.draft.buffer;
      const anchor = suffix => {
        const audio = Number(this.el('sync-audio' + suffix).value);
        if (this.el('sync-audio' + suffix).value === '' || audio < 0 || audio >= buffer.duration) throw new Error('Choose a recording timestamp inside the audio file.');
        return { midi: midiPositionTime(chart, Number(this.el('sync-bar' + suffix).value), Number(this.el('sync-beat' + suffix).value)), audio };
      };
      this.set(fitAlignment(anchor(''), this.el('sync-second').checked ? anchor('-2') : null, this.owner.draft.timeScale ?? 1));
    } catch (error) { this.status(error.message); }
  }
  async analyze() {
    if (this.owner.busy || !this.owner.draft?.buffer) return;
    this.stop(); const owner = this.owner, token = ++owner.token, d = owner.draft;
    owner.busy = true; owner.render(); this.candidates = []; this.el('sync-candidates').innerHTML = '';
    const options = { offset: d.offset, timeScale: d.timeScale ?? 1, drift: this.el('sync-drift').checked, window: Number(this.el('sync-window').value), cancelled: () => token !== owner.token, progress: message => { if (token === owner.token) this.status(message); } };
    try {
      if (this.featureBuffer !== d.buffer) { this.features = await audioOnsets(d.buffer, options); this.featureBuffer = d.buffer; }
      const candidates = await suggestAlignment(this.base(), this.features, options);
      if (token !== owner.token) return;
      this.candidates = candidates;
      this.el('sync-candidates').innerHTML = candidates.map((item, i) => `<button type="button" class="sync-candidate" data-sync="${i}"><strong>${i === 0 ? 'Best candidate' : 'Alternative ' + i}</strong><span>${item.offset.toFixed(3)} s · ${(100 / item.timeScale).toFixed(2)}% MIDI speed</span><small>Use this candidate →</small></button>`).join('');
      this.status('Suggestions ready. Repeated grooves may match several bars. Choose a candidate, preview the start and a later bar, then fine-tune if needed.');
    } catch (error) { if (token === owner.token) this.status(error.message); }
    finally { if (token === owner.token) { owner.busy = false; owner.render(); } }
  }
  stop() {
    clearTimeout(this.timer);
    if (this.preview) this.owner.audio.silence();
    this.preview = false; this.el('stop-sync').disabled = true;
    this.el('sync-preview-state').textContent = '';
  }
  async play(together) {
    if (this.owner.busy || !this.owner.draft?.buffer) return;
    this.stop(); const token = this.owner.token, d = this.owner.draft;
    try {
      const chart = alignMidiChart(this.base(), d.timeScale ?? 1);
      const midi = together ? midiPositionTime(this.base(), Number(this.el('sync-bar').value), Number(this.el('sync-beat').value)) * (d.timeScale ?? 1) : 0;
      const position = together ? midi - d.offset : Number(this.el('sync-audio').value);
      if (!Number.isFinite(position) || (!together && (position < 0 || position >= d.buffer.duration))) throw new Error('Choose a position inside the recording.');
      await this.owner.audio.ready();
      if (token !== this.owner.token || !this.owner.dialog.open) return;
      const at = this.owner.audio.context.currentTime + 0.08, duration = together ? Math.min(8, chart.duration - midi) : Math.min(8, d.buffer.duration - position);
      const delay = Math.max(0, -position), offset = Math.max(0, position), audioDuration = Math.min(duration - delay, d.buffer.duration - offset);
      if (audioDuration > 0) this.owner.audio.playBacking(d.buffer, at + delay, offset, d.volume, audioDuration);
      if (together) {
        for (const beat of chart.beats) if (beat.time >= midi - 1e-8 && beat.time < midi + duration) this.owner.audio.click(at + beat.time - midi, beat.downbeat);
        if (this.el('sync-guide').checked) for (const note of chart.notes) if (note.time >= midi - 1e-8 && note.time < midi + duration) this.owner.audio.play(note.drum, at + note.time - midi, note.velocity * 0.65);
      }
      this.preview = true; this.el('stop-sync').disabled = false;
      this.el('sync-preview-state').textContent = together ? `Playing ${duration.toFixed(1)} seconds from MIDI bar ${this.el('sync-bar').value}, beat ${this.el('sync-beat').value}, with a click${this.el('sync-guide').checked ? ' and guide drums' : ''}.` : `Playing recording from ${position.toFixed(3)} seconds.`;
      this.timer = setTimeout(() => this.stop(), (duration + 0.2) * 1000);
    } catch (error) { this.status(error.message); }
  }
  draw() {
    const canvas = this.el('sync-waveform'), buffer = this.owner.draft?.buffer;
    if (!buffer || !this.el('audio-sync').open) return;
    const width = Math.max(280, canvas.clientWidth), height = 140, dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = width * dpr; canvas.height = height * dpr;
    const context = canvas.getContext('2d'); context.scale(dpr, dpr); context.fillStyle = '#122326'; context.fillRect(0, 0, width, height);
    const position = Math.max(0, Math.min(buffer.duration, Number(this.el('sync-audio').value) || 0));
    const length = Math.min(buffer.duration, Number(this.el('sync-zoom').value));
    const start = Math.max(0, Math.min(buffer.duration - length, position - length / 2));
    this.waveStart = start; this.waveLength = length;
    const channel = buffer.getChannelData(0);
    context.strokeStyle = '#63b5a6'; context.lineWidth = 1;
    for (let x = 0; x < width; x++) {
      const a = Math.floor((start + x / width * length) * buffer.sampleRate), b = Math.min(buffer.length, Math.ceil((start + (x + 1) / width * length) * buffer.sampleRate));
      let peak = 0;
      for (let i = a; i < b; i += Math.max(1, Math.floor((b - a) / 80))) peak = Math.max(peak, Math.abs(channel[i]));
      context.beginPath(); context.moveTo(x, 70 - peak * 45); context.lineTo(x, 70 + peak * 45); context.stroke();
    }
    try {
      const d = this.owner.draft, chart = alignMidiChart(this.base(), d.timeScale ?? 1);
      for (const beat of chart.beats) {
        const time = beat.time - d.offset;
        if (time < start || time > start + length) continue;
        const x = (time - start) / length * width;
        context.strokeStyle = beat.downbeat ? '#e8c17b99' : '#ffffff22'; context.beginPath(); context.moveTo(x, 22); context.lineTo(x, 117); context.stroke();
        if (beat.downbeat) { context.fillStyle = '#e8c17b'; context.font = '10px Segoe UI'; context.fillText(`BAR ${beat.bar}`, x + 3, 15); }
      }
    } catch { /* The waveform is still useful while mapping is incomplete. */ }
    const x = (position - start) / length * width;
    context.strokeStyle = '#f4c984'; context.lineWidth = 2; context.beginPath(); context.moveTo(x, 20); context.lineTo(x, 120); context.stroke();
    context.fillStyle = '#b2c9c0'; context.font = '11px Segoe UI'; context.fillText(`${start.toFixed(2)} s`, 8, 133); context.textAlign = 'right'; context.fillText(`${(start + length).toFixed(2)} s`, width - 8, 133);
  }
}
