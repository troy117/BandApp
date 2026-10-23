import { pitchName } from './instruments.mjs';
import { vocalTarget } from './vocal-guide.mjs';

// YIN's normalized difference finds the fundamental, rather than the loudest harmonic.
// Downsampling bounds the work on phones. No audio leaves the caller's buffer.
export function detectVocalPitch(input, sampleRate) {
  if (!input?.length || !Number.isFinite(sampleRate) || sampleRate < 8000) return null;
  const stride = Math.max(1, Math.floor(sampleRate / 12000)), rate = sampleRate / stride;
  const size = Math.floor(input.length / stride), signal = new Float32Array(size);
  let mean = 0, energy = 0, clipped = 0;
  for (let i = 0; i < input.length; i++) { mean += input[i]; energy += input[i] ** 2; if (Math.abs(input[i]) >= .98) clipped++; }
  mean /= input.length;
  const rms = Math.sqrt(Math.max(0, energy / input.length - mean ** 2));
  if (!Number.isFinite(rms) || rms < .008) return null;
  for (let i = 0; i < size; i++) {
    let value = 0; for (let j = 0; j < stride; j++) value += input[i * stride + j] - mean;
    signal[i] = value / stride;
  }
  const minLag = Math.max(2, Math.floor(rate / 1400)), maxLag = Math.ceil(rate / 55), window = size - maxLag;
  if (window < maxLag) return null;
  const difference = new Float32Array(maxLag + 1); let total = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window; i++) sum += (signal[i] - signal[i + lag]) ** 2;
    total += sum; difference[lag] = total > 0 ? sum * lag / total : 1;
  }
  for (let lag = minLag; lag < maxLag; lag++) {
    if (difference[lag] >= .15) continue;
    while (lag + 1 < maxLag && difference[lag + 1] < difference[lag]) lag++;
    const left = difference[lag - 1], center = difference[lag], right = difference[lag + 1];
    const denominator = left - 2 * center + right;
    const refined = lag + (Math.abs(denominator) > 1e-12 ? .5 * (left - right) / denominator : 0);
    const frequency = rate / refined, confidence = 1 - center;
    if (frequency < 55 || frequency > 1400 || confidence < .85) return null;
    return { frequency, midi: 69 + 12 * Math.log2(frequency / 440), confidence, rms, clipped: clipped / input.length > .02 };
  }
  return null;
}

export function vocalPitchFeedback(detection, notes, time, { anyOctave = true, tolerance = 35 } = {}) {
  const target = vocalTarget(notes, time), pitches = [...new Set(target.active.map(note => note.pitch))];
  const neutral = (state, label, hint) => ({ state, label, hint, target: pitches.length === 1 ? pitchName(pitches[0]) : '—', heard: '—', cents: null });
  if (!notes.length) return neutral('no-melody', 'Lyrics only', 'Your teacher can add a vocal melody to enable pitch feedback.');
  if (time < 0) return neutral('ready', 'Get ready', 'Breathe in and follow the count-in.');
  if (!pitches.length) return neutral('rest', 'Rest · breathe', target.next ? 'Your next note is ' + pitchName(target.next.pitch) + '.' : 'You’ve reached the end of the melody.');
  if (pitches.length > 1) return neutral('unclear', 'Follow the melody', 'Overlapping melody notes · pitch feedback waits for a single note.');
  if (!detection || detection.confidence < .85 || !Number.isFinite(detection.midi)) return neutral('quiet', 'Sing a steady note', 'Hold a vowel so your microphone can find your pitch.');
  if (detection.clipped) return neutral('unclear', 'A little more space', 'Move your phone slightly farther away. The microphone is too loud.');
  const active = target.active.find(note => note.pitch === pitches[0]);
  if (time - active.time < .08) return neutral('changing', 'Find the note', 'Let the new note settle.');
  const reference = pitches[0] + (anyOctave ? 12 * Math.round((detection.midi - pitches[0]) / 12) : 0);
  const cents = (detection.midi - reference) * 100, onPitch = Math.abs(cents) <= tolerance;
  return { state: onPitch ? 'on-pitch' : cents < 0 ? 'low' : 'high', label: onPitch ? 'On pitch' : cents < 0 ? '↑ Sing a little higher' : '↓ Sing a little lower', hint: onPitch ? 'Keep it steady. You’re matching the melody.' : Math.abs(cents) < 100 ? 'A small adjustment will get you there.' : 'Listen for the target note, then try matching it.', target: pitchName(reference), heard: pitchName(Math.round(detection.midi)), cents };
}
