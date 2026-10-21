// Voices are local. MIDI input never transmits or records instrument audio.
export class PianoVoices {
  constructor(audio) { this.audio = audio; this.voices = new Map(); this.active = new Set(); }
  on(id, pitch, velocity = 0.7, at) {
    const context = this.audio.context;
    if (!context || context.state !== 'running') return;
    this.off(id);
    const oscillator = context.createOscillator(), gain = context.createGain(), when = Math.max(context.currentTime, at ?? context.currentTime);
    oscillator.type = 'triangle'; oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(Math.max(0.015, velocity * 0.22), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.025, when + 1.2);
    oscillator.connect(gain).connect(this.audio.master); oscillator.start(when);
    const voice = { oscillator, gain }; this.voices.set(id, voice); this.active.add(voice); this.audio.sources.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.active.delete(voice); this.audio.sources.delete(oscillator); if (this.voices.get(id) === voice) this.voices.delete(id); };
    oscillator.stop(when + 8);
  }
  off(id, at) {
    const voice = this.voices.get(id), context = this.audio.context;
    if (!voice || !context) return;
    const when = Math.max(context.currentTime, at ?? context.currentTime);
    voice.gain.gain.cancelScheduledValues(when); voice.gain.gain.setTargetAtTime(0.0001, when, 0.025);
    try { voice.oscillator.stop(when + 0.15); } catch {}
  }
  clear() {
    for (const voice of this.active) { try { voice.oscillator.stop(); } catch {} }
    this.voices.clear();
  }
}
