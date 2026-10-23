import { detectVocalPitch } from './vocal-pitch.mjs';

export class VocalMicrophone {
  constructor({ onState = () => {}, environment = globalThis } = {}) {
    this.environment = environment; this.onState = onState; this.generation = 0; this.state = 'off'; this.message = 'Your microphone is off.';
  }
  notify(state, message) { this.state = state; this.message = message; this.onState({ state, message }); }
  async start() {
    if (this.state === 'requesting' || this.state === 'listening') return;
    const env = this.environment, Context = env.AudioContext || env.webkitAudioContext;
    if (!env.navigator?.mediaDevices?.getUserMedia || !Context || env.isSecureContext === false) {
      this.notify('unsupported', 'Open the school’s HTTPS link in Safari or Chrome to use your microphone. Lyrics still work without it.'); return;
    }
    const generation = ++this.generation;
    this.notify('requesting', 'Tap Allow when your phone asks to use the microphone.');
    let context, stream;
    try {
      // Create/resume during the tap so mobile browsers can unlock audio.
      context = new Context({ latencyHint: 'interactive' }); this.context = context;
      const resumed = context.resume();
      const requested = env.navigator.mediaDevices.getUserMedia({ video: false, audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false } } });
      // Attach both rejection handlers immediately, including while permission is pending.
      const results = await Promise.allSettled([resumed, requested]);
      if (results[1].status === 'fulfilled') stream = results[1].value;
      if (generation !== this.generation) { stream?.getTracks().forEach(track => track.stop()); return; }
      if (results[0].status === 'rejected') throw results[0].reason;
      if (results[1].status === 'rejected') throw results[1].reason;
      this.stream = stream;
      await context.resume();
      if (generation !== this.generation) return;
      if (context.state !== 'running') throw new Error('AudioInterrupted');
      this.source = context.createMediaStreamSource(stream); this.analyser = context.createAnalyser();
      this.analyser.fftSize = 4096; this.buffer = new Float32Array(this.analyser.fftSize);
      this.source.connect(this.analyser); // Never monitor the microphone through the speakers.
      for (const track of stream.getAudioTracks()) track.addEventListener('ended', () => { if (generation === this.generation) this.stop('interrupted', 'Microphone disconnected. Tap Enable microphone to try again.'); });
      for (const track of stream.getAudioTracks()) track.addEventListener('mute', () => { if (generation === this.generation) this.stop('interrupted', 'Your phone muted the microphone. Tap Enable microphone to reconnect.'); });
      context.addEventListener('statechange', () => { if (generation === this.generation && this.state === 'listening' && context.state !== 'running') this.stop('interrupted', 'Microphone paused by your phone. Tap Enable microphone to reconnect.'); });
      this.history = []; this.lastSample = -Infinity; this.latest = null;
      this.notify('listening', 'Mic on · headphones help it hear just your voice.');
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (generation !== this.generation) return;
      const denied = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name);
      const message = denied ? 'Microphone access was blocked. Allow it in this site’s browser settings, then try again. You can still sing with the lyrics.' : ['NotFoundError', 'DevicesNotFoundError'].includes(error.name) ? 'No microphone found. Check your phone or headset, then try again.' : 'The microphone could not start. Close other apps using it, then tap Enable microphone to retry.';
      this.stop(denied ? 'denied' : 'error', message);
    } finally {
      if (context && context !== this.context) context.close().catch(() => {});
    }
  }
  sample() {
    if (this.state !== 'listening' || !this.analyser) return null;
    const now = this.environment.performance.now() / 1000;
    if (now - this.lastSample < .06) return this.latest ? { ...this.latest, age: this.latest.age + now - this.lastSample } : null;
    this.lastSample = now; this.analyser.getFloatTimeDomainData(this.buffer);
    const detected = detectVocalPitch(this.buffer, this.context.sampleRate);
    if (!detected) { this.history = []; this.latest = null; return null; }
    this.history = this.history.filter(item => now - item.at < .18 && Math.abs(item.midi - detected.midi) < .8);
    this.history.push({ ...detected, at: now });
    // Two consistent frames keep consonants/transients from flashing a wrong note.
    if (this.history.length < 2) { this.latest = null; return null; }
    const sorted = this.history.map(item => item.midi).sort((a, b) => a - b);
    this.latest = { ...detected, midi: sorted[Math.floor(sorted.length / 2)], age: this.buffer.length / (2 * this.context.sampleRate) };
    return this.latest;
  }
  stop(state = 'off', message = 'Your microphone is off.') {
    this.generation++;
    const context = this.context; this.context = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.source?.disconnect(); this.analyser?.disconnect(); this.source = this.analyser = this.buffer = this.latest = null;
    this.history = []; context?.close().catch(() => {});
    this.notify(state, message);
  }
}
