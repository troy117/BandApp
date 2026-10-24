// Bound playback in the original recording clock without changing its bytes or alignment.
export function validateAudioRange(input = {}, duration = Infinity) {
  const start = input.audioStart ?? 0, end = input.audioEnd ?? null;
  if (!Number.isFinite(start) || start < 0 || start > 86400 || end !== null && (!Number.isFinite(end) || end <= start || end > 86400)) throw new Error('Choose a recording end after its start, in seconds.');
  if (start >= duration || end !== null && end > duration + .001) throw new Error('Choose start and end positions inside the recording.');
  return start === 0 && end === null ? {} : {audioStart:start, audioEnd:end};
}

export function backingClip(backing, from = 0, to = Infinity) {
  const duration = backing.buffer.duration, start = Math.max(0, backing.audioStart ?? 0, from - backing.offset);
  const end = Math.min(duration, backing.audioEnd ?? duration, to - backing.offset);
  return end > start ? {when:backing.offset + start, offset:start, duration:end-start} : null;
}
