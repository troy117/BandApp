export class DrumAudio {
  context = null;
  sources = new Set();
  backingGains = new Set();
  initialize() {
    if (!this.context) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support audio. Try Chrome on Windows or Chromebook.');
      this.context = new Context({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      this.output = this.context.createDynamicsCompressor();
      this.output.threshold.value = -8;
      this.master.connect(this.output).connect(this.context.destination);
      this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const channel = this.noise.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
    }
  }
  async ready() {
    this.initialize();
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio could not start. Click Start groove again.');
  }
  async decodeBacking(bytes) {
    this.initialize();
    try { return await this.context.decodeAudioData(bytes); }
    catch { throw new Error('This browser could not decode that audio. Try an MP3 or WAV file.'); }
  }
  playBacking(buffer, when, offset, volume = 0.65, duration) {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = Math.max(0, Math.min(1, volume));
    this.backingGains.add(gain);
    source.connect(gain).connect(this.output);
    this.sources.add(source);
    source.addEventListener('ended', () => { this.sources.delete(source); this.backingGains.delete(gain); source.disconnect(); gain.disconnect(); }, { once: true });
    if (duration === undefined) source.start(when, offset);
    else source.start(when, offset, duration);
    return source;
  }
  setBackingVolume(volume) {
    const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.65;
    for (const gain of this.backingGains) {
      if (gain.gain.setTargetAtTime) gain.gain.setTargetAtTime(level, this.context.currentTime, 0.015);
      else gain.gain.value = level;
    }
    return level;
  }
  audibleTime(timestamp = performance.now()) {
    if (!this.context) return 0;
    const stamp = this.context.getOutputTimestamp?.();
    if (stamp?.contextTime > 0 && stamp.performanceTime > 0) return stamp.contextTime + (timestamp - stamp.performanceTime) / 1000;
    return this.context.currentTime - (this.context.outputLatency || this.context.baseLatency || 0) - (performance.now() - timestamp) / 1000;
  }
  track(source, time, duration) {
    this.sources.add(source);
    source.addEventListener('ended', () => this.sources.delete(source), { once: true });
    source.start(time);
    source.stop(time + duration);
  }
  tone(frequency, endFrequency, time, duration, level, type = 'sine') {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    gain.gain.setValueAtTime(Math.max(0.001, level), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain).connect(this.master);
    this.track(osc, time, duration + 0.01);
  }
  hiss(frequency, time, duration, level, filterType = 'highpass') {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noise;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(Math.max(0.001, level), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(this.master);
    this.track(source, time, duration + 0.01);
  }
  play(drum, time = this.context?.currentTime, velocity = 1) {
    if (!this.context || this.context.state !== 'running') return;
    time = Math.max(time, this.context.currentTime);
    const level = Math.min(1, Math.max(0.08, velocity));
    if (drum === 'kick') this.tone(145, 42, time, 0.24, 1.1 * level);
    else if (drum === 'snare') { this.hiss(1700, time, 0.15, 0.65 * level); this.tone(185, 90, time, 0.12, 0.35 * level, 'triangle'); }
    else if (drum === 'hihat') this.hiss(6500, time, 0.055, 0.34 * level);
    else if (drum === 'crash') this.hiss(4800, time, 0.7, 0.5 * level);
    else if (drum === 'ride') { this.hiss(6000, time, 0.2, 0.24 * level); this.tone(1700, 1400, time, 0.18, 0.13 * level, 'triangle'); }
    else this.tone({ tom1: 235, tom2: 175, tom3: 118 }[drum] || 180, 65, time, 0.22, 0.65 * level, 'triangle');
  }
  click(time, downbeat = false) { this.tone(downbeat ? 1300 : 900, downbeat ? 1300 : 900, Math.max(time, this.context.currentTime), 0.035, downbeat ? 0.28 : 0.18); }
  silence() { for (const source of this.sources) { try { source.stop(); } catch {} } this.sources.clear(); this.backingGains.clear(); }
}
