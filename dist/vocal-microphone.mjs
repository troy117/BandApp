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
      const requested = env.navigator.mediaDevices.getUserMedia({ video: false, audio: { channelCount: { ideal: 1 }, latency: { ideal: .01 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false } } });
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
      this.analyser.fftSize = 2 ** Math.ceil(Math.log2(context.sampleRate * .04)); this.buffer = new Float32Array(this.analyser.fftSize);
      const reported = stream.getAudioTracks()[0]?.getSettings?.().latency;
      this.latencyReported = Number.isFinite(reported) && reported >= 0 && reported <= 1;
      this.inputLatency = this.latencyReported ? reported : .08;
      this.source.connect(this.analyser); // Never monitor the microphone through the speakers.
      for (const track of stream.getAudioTracks()) track.addEventListener('ended', () => { if (generation === this.generation) this.stop('interrupted', 'Microphone disconnected. Tap Enable microphone to try again.'); });
      for (const track of stream.getAudioTracks()) track.addEventListener('mute', () => { if (generation === this.generation) this.stop('interrupted', 'Your phone muted the microphone. Tap Enable microphone to reconnect.'); });
      context.addEventListener('statechange', () => { if (generation === this.generation && this.state === 'listening' && context.state !== 'running') this.stop('interrupted', 'Microphone paused by your phone. Tap Enable microphone to reconnect.'); });
      this.history = []; this.lastSample = -Infinity; this.capturedAt = null; this.latest = null;
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
  sampleAge() {
    return this.capturedAt === null || this.capturedAt === undefined ? 0 : Math.max(0, this.environment.performance.now() / 1000 - this.capturedAt);
  }
  sample() {
    if (this.state !== 'listening' || !this.analyser) return null;
    const now = this.environment.performance.now() / 1000;
    if (now - this.lastSample < .032) return this.latest ? { ...this.latest, age: this.sampleAge() } : null;
    this.lastSample = now; this.analyser.getFloatTimeDomainData(this.buffer);
    // Timestamp silence too: a lost vowel must not move the scoring clock ahead.
    this.capturedAt = now - this.inputLatency - this.buffer.length / (2 * this.context.sampleRate);
    const detected = detectVocalPitch(this.buffer, this.context.sampleRate);
    if (!detected) { this.history = []; this.latest = null; return null; }
    this.history = this.history.filter(item => now - item.at < .09 && Math.abs(item.midi - detected.midi) < .8);
    this.history.push({ ...detected, at: now });
    // Two consistent frames keep consonants/transients from flashing a wrong note.
    if (this.history.length < 2) { this.latest = null; return null; }
    // Use the current frame after confirmation. A trailing median delayed changes
    // by additional frames, even when the new pitch was already unambiguous.
    this.latest = detected;
    return { ...detected, age: this.sampleAge() };
  }
  stop(state = 'off', message = 'Your microphone is off.') {
    this.generation++;
    const context = this.context; this.context = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.source?.disconnect(); this.analyser?.disconnect(); this.source = this.analyser = this.buffer = this.latest = null;
    this.history = []; this.capturedAt = null; context?.close().catch(() => {});
    this.notify(state, message);
  }
}
