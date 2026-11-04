import { DRUMS } from './engine.mjs';

export const BEAT_LIMITS = { bytes: 60 * 1024 * 1024, audioSeconds: 600, seconds: 1200, loops: 16, hits: 50000 };

export function beatPlan(loopSeconds, { repeats = 4, bpm = 80, countIn = true, offset = 0 } = {}) {
  if (!Number.isFinite(loopSeconds) || loopSeconds < .1 || loopSeconds > BEAT_LIMITS.audioSeconds) throw new Error('Choose audio between 0.1 seconds and 10 minutes long.');
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > BEAT_LIMITS.loops) throw new Error('Choose 1–16 repeats.');
  if (loopSeconds * repeats > BEAT_LIMITS.seconds) throw new Error('Reduce the repeats to keep the take within 20 minutes.');
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 200) throw new Error('Choose a count-in tempo from 40–200 BPM.');
  if (!Number.isFinite(offset) || Math.abs(offset) > .2) throw new Error('The input delay correction is invalid.');
  return { loopSeconds, repeats, duration: loopSeconds * repeats, bpm, countIn: Boolean(countIn), offset };
}

export function validateBeatTake(take, loopSeconds) {
  if (!take || take.version !== 1 || typeof take.id !== 'string' || !take.id || take.id.length > 100) throw new Error('This saved take is not supported.');
  const plan = beatPlan(loopSeconds, take);
  if (!Number.isFinite(take.loopSeconds) || Math.abs(take.loopSeconds - loopSeconds) > .01 || !Number.isFinite(take.duration) || take.duration <= 0 || take.duration > plan.duration + .001) throw new Error('The take does not match its audio.');
  if (!Array.isArray(take.hits) || !take.hits.length || take.hits.length > BEAT_LIMITS.hits) throw new Error('The saved take has no valid drum hits.');
  let previous = -1;
  for (const hit of take.hits) {
    if (!DRUMS.some(drum => drum.id === hit.drum) || !Number.isFinite(hit.time) || hit.time < previous || hit.time < 0 || hit.time >= take.duration || !Number.isFinite(hit.velocity) || hit.velocity <= 0 || hit.velocity > 1) throw new Error('The saved take contains an invalid drum hit.');
    previous = hit.time;
  }
  return take;
}

// Audio scheduling and input timestamps share the audible Web Audio clock.
// Animation and setInterval never determine a hit's timestamp or a loop boundary.
export class BeatRecorder {
  constructor(audio, onChange = () => {}) {
    this.audio = audio; this.onChange = onChange; this.source = null; this.take = null;
    this.run = null; this.starting = false; this.token = 0; this.timer = null;
    this.backingVolume = .65; this.beatVolume = .8;
    this.stateListener = () => {
      if (this.run && this.audio.context.state !== 'running') this.stop('Audio was interrupted. The take stops here; press Record or Play to start again.');
    };
  }
  get busy() { return Boolean(this.run || this.starting); }
  setSource(source, take = null) {
    if (!(source.bytes instanceof ArrayBuffer) || !source.bytes.byteLength || source.bytes.byteLength > BEAT_LIMITS.bytes) throw new Error('Choose an audio file up to 60 MB.');
    beatPlan(source.buffer.duration, { repeats: 1 });
    if (take) validateBeatTake(take, source.buffer.duration);
    this.stop(); this.source = source; this.take = take;
    this.onChange(take ? 'Saved take opened. Play it back and join in.' : 'Audio ready. Choose repeats, then record your beat.');
  }
  async start(mode, options = {}) {
    if (this.busy) return false;
    if (!this.source) throw new Error('Choose an audio file first.');
    if (mode !== 'record' && mode !== 'replay') throw new Error('Choose Record or Play.');
    if (mode === 'replay' && !this.take) throw new Error('Record a beat first.');
    const plan = mode === 'record' ? beatPlan(this.source.buffer.duration, options) : { ...this.take, ...{ countIn: Boolean(options.countIn), bpm: options.bpm ?? this.take.bpm } };
    beatPlan(plan.loopSeconds, plan);
    const token = ++this.token;
    this.starting = true; this.onChange('Starting audio…');
    try {
      await this.audio.ready();
      if (token !== this.token) return false;
      this.audio.silence();
      this.audio.context.removeEventListener('statechange', this.stateListener);
      this.audio.context.addEventListener('statechange', this.stateListener);
      const countSeconds = plan.countIn ? 4 * 60 / plan.bpm : 0;
      const startAt = this.audio.context.currentTime + .15 + countSeconds;
      this.run = { mode, plan, startAt, hits: [], next: 0, lastTime: -countSeconds, source: this.source };
      if (plan.countIn) for (let i = 0; i < 4; i++) this.audio.click(startAt - (4 - i) * 60 / plan.bpm, i === 0);
      for (let i = 0; i < plan.repeats; i++) {
        const duration = Math.min(plan.loopSeconds, plan.duration - i * plan.loopSeconds);
        if (duration <= 0) break;
        this.audio.playBacking(this.source.buffer, startAt + i * plan.loopSeconds, 0, this.backingVolume, duration);
      }
      this.starting = false;
      this.timer = setInterval(() => this.tick(), 25);
      this.onChange(mode === 'record' ? 'Recording armed. Play after the count-in. Stop keeps the part you played.' : 'Playing your take. Join in on the kit or keyboard; your saved beat stays unchanged.');
      this.tick(); return true;
    } catch (error) {
      if (token !== this.token) return false;
      this.stop(); throw error;
    }
  }
  position() {
    return this.run ? this.audio.audibleTime() - this.run.startAt : 0;
  }
  tick() {
    const run = this.run;
    if (!run) return;
    const time = this.position(); run.lastTime = time;
    if (run.mode === 'replay') {
      const until = this.audio.context.currentTime + .12;
      while (run.next < this.take.hits.length && run.startAt + this.take.hits[run.next].time <= until) {
        const hit = this.take.hits[run.next++];
        // A delayed scheduler must not play an old burst of hits at once.
        if (run.startAt + hit.time >= this.audio.context.currentTime - .04 && this.beatVolume > 0) this.audio.play(hit.drum, run.startAt + hit.time, hit.velocity * this.beatVolume);
      }
    }
    if (time >= run.plan.duration) this.stop(run.mode === 'record' ? 'Take complete. Play it back, or save it on this device.' : 'Playback complete. Play again to practice another time.', true);
  }
  hit(drum, timestamp, velocity = 1, sound = true) {
    if (!DRUMS.some(item => item.id === drum) || !Number.isFinite(velocity) || velocity <= 0 || !Number.isFinite(timestamp)) return false;
    velocity = Math.min(1, velocity);
    if (sound && this.audio.context?.state === 'running') this.audio.play(drum, undefined, velocity);
    const run = this.run;
    if (!run || run.mode !== 'record') return false;
    const normalized = timestamp > 1e12 ? timestamp - performance.timeOrigin : timestamp;
    const raw = this.audio.audibleTime(normalized) - run.startAt;
    const time = raw - run.plan.offset;
    if (raw < 0 || raw >= run.plan.duration || time < 0 || time >= run.plan.duration) return false;
    if (run.hits.length >= BEAT_LIMITS.hits) { this.stop('The take reached 50,000 hits. The recorded part is ready to play or save.'); return false; }
    run.hits.push({ drum, time, velocity }); return true;
  }
  stop(message = '', complete = false) {
    ++this.token; this.starting = false;
    clearInterval(this.timer); this.timer = null;
    const run = this.run;
    if (run?.mode === 'record') {
      // A statechange can arrive between a hit and the next scheduler tick.
      // Preserve those final captured hits even if the suspended clock is stale.
      const lastHitEnd = run.hits.reduce((end, hit) => Math.max(end, hit.time + .001), 0);
      const now = this.audio.context.state === 'running' ? this.position() : Math.max(run.lastTime, lastHitEnd);
      const duration = Math.min(run.plan.duration, Math.max(0, complete ? run.plan.duration : now));
      const hits = run.hits.filter(hit => hit.time < duration).sort((a, b) => a.time - b.time);
      if (hits.length) this.take = { ...run.plan, version: 1, id: globalThis.crypto.randomUUID(), createdAt: Date.now(), duration, hits };
      else if (message) message += ' No drum hits were recorded; your previous take is unchanged.';
    }
    this.run = null;
    this.audio.silence();
    this.audio.context?.removeEventListener('statechange', this.stateListener);
    if (message) this.onChange(message);
  }
  clear() { this.stop(); this.source = null; this.take = null; }
}
