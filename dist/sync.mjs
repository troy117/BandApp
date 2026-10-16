// Alignment is audioTime = midiTime * timeScale - offset. Audio stays at 1x;
// the MIDI clock follows the recording, preserving its internal tempo changes.
export function validateAlignment(offset = 0, timeScale = 1) {
  if (!Number.isFinite(offset) || Math.abs(offset) > 300) throw new Error('Choose an audio offset between −300 and +300 seconds.');
  if (!Number.isFinite(timeScale) || timeScale < 0.5 || timeScale > 2) throw new Error('Choose a MIDI speed between 50% and 200%.');
  return { offset, timeScale };
}

export function alignMidiChart(chart, timeScale = 1) {
  validateAlignment(0, timeScale);
  if (chart.duration * timeScale > 1200) throw new Error('The adjusted MIDI would exceed 20 minutes. Choose a faster MIDI speed.');
  return { ...chart, timeScale, duration: chart.duration * timeScale, bpm: chart.bpm / timeScale, countInBeatSeconds: chart.countInBeatSeconds * timeScale,
    notes: chart.notes.map(note => ({ ...note, time: note.time * timeScale })), beats: chart.beats.map(beat => ({ ...beat, time: beat.time * timeScale })),
    tempos: chart.tempos.map(tempo => ({ ...tempo, time: tempo.time * timeScale, bpm: tempo.bpm / timeScale })),
    signatures: chart.signatures.map(meter => ({ ...meter, time: meter.time * timeScale })),
    measures: chart.measures.map(measure => ({ ...measure, time: measure.time * timeScale, endTime: measure.endTime * timeScale })) };
}

export function fitAlignment(first, second, currentScale = 1) {
  if (![first.midi, first.audio].every(Number.isFinite) || first.midi < 0 || first.audio < 0) throw new Error('Choose valid matching MIDI and recording positions.');
  let timeScale = currentScale;
  if (second) {
    if (![second.midi, second.audio].every(Number.isFinite) || second.midi - first.midi < 4 || second.audio - first.audio < 2) throw new Error('Place the second match later in both files, at least four MIDI seconds after the first.');
    timeScale = (second.audio - first.audio) / (second.midi - first.midi);
  }
  return validateAlignment(first.midi * timeScale - first.audio, timeScale);
}

export function midiPositionTime(chart, bar, beat) {
  const measure = chart.measures.find(item => item.bar === Number(bar));
  if (!measure || !Number.isFinite(beat) || beat < 1 || beat >= measure.numerator + 1) throw new Error('Choose a MIDI bar and beat inside the song.');
  const quarter = measure.startQuarter + (beat - 1) * 4 / measure.denominator;
  if (quarter >= measure.endQuarter - 1e-8) throw new Error('That beat is past the end of this MIDI section.');
  const tempo = chart.tempos.findLast(item => item.quarter <= quarter) || chart.tempos[0];
  return tempo.time + (quarter - tempo.quarter) * 60 / tempo.bpm;
}

const syncYield = () => new Promise(resolve => setTimeout(resolve, 0));
function syncCancelled(options) { if (options.cancelled?.()) throw new Error('Analysis cancelled.'); }

// Lightweight multiband energy novelty, not a drum transcription model. Process
// channel energies separately so opposite-polarity stereo hits do not disappear.
export async function audioOnsets(buffer, options = {}) {
  const rate = 100, stride = Math.max(1, Math.floor(buffer.sampleRate / 11025));
  const frames = Math.ceil(buffer.duration * rate), hop = buffer.sampleRate / rate;
  const raw = new Float32Array(frames), peaks = new Float32Array(frames);
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, i) => buffer.getChannelData(i));
  const lows = channels.map(() => 0), previous = channels.map(() => 0);
  const alpha = 1 - Math.exp(-2 * Math.PI * 200 / (buffer.sampleRate / stride));
  let prevEnergy = [0, 0, 0], average = [0, 0, 0];
  for (let frame = 0; frame < frames; frame++) {
    const energy = [0, 0, 0]; let count = 0, peak = 0;
    for (let i = Math.floor(frame * hop); i < Math.min(buffer.length, (frame + 1) * hop); i += stride) {
      for (let c = 0; c < channels.length; c++) {
        const sample = channels[c][i] || 0;
        lows[c] += alpha * (sample - lows[c]);
        const high = sample - previous[c]; previous[c] = sample;
        energy[0] += sample * sample; energy[1] += lows[c] * lows[c]; energy[2] += high * high;
        peak = Math.max(peak, Math.abs(sample)); count++;
      }
    }
    let value = 0;
    for (let band = 0; band < 3; band++) {
      const e = Math.sqrt(energy[band] / Math.max(1, count));
      average[band] = average[band] * 0.98 + e * 0.02;
      value += Math.max(0, e - prevEnergy[band]) / Math.max(0.003, average[band]) * (band === 0 ? 0.4 : 0.3);
      prevEnergy[band] = e;
    }
    raw[frame] = Math.min(20, value); peaks[frame] = peak;
    if (frame % 1500 === 0) { syncCancelled(options); options.progress?.(`Reading recording… ${Math.round(frame / frames * 100)}%`); await syncYield(); }
  }
  syncCancelled(options);
  const mean = raw.reduce((a, b) => a + b, 0) / frames;
  const variance = raw.reduce((a, b) => a + (b - mean) ** 2, 0) / frames;
  if (Math.max(...peaks.subarray(0, Math.min(peaks.length, 100000))) < 0.002 || variance < 1e-7) throw new Error('There are no clear attacks to compare. Use the waveform and a manual beat match.');
  const deviation = Math.sqrt(variance), envelope = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    // Center a narrow tolerance window around each attack (±20 ms).
    let value = raw[i];
    for (let d = -2; d <= 2; d++) value = Math.max(value, (raw[i + d] || 0) * (1 - Math.abs(d) * 0.18));
    envelope[i] = Math.max(-1, Math.min(5, (value - mean) / deviation));
  }
  return { envelope, peaks, rate, duration: buffer.duration };
}

export async function suggestAlignment(chart, features, options = {}) {
  const current = validateAlignment(options.offset ?? 0, options.timeScale ?? 1);
  const window = options.window === 12 ? 12 : 60;
  const byTime = new Map();
  for (const note of chart.notes) {
    const key = Math.round(note.time * 1000);
    const weight = ['kick', 'snare'].includes(note.drum) ? 1 : 0.45;
    const old = byTime.get(key);
    byTime.set(key, { time: note.time, weight: Math.max(weight, old?.weight || 0) });
  }
  const hits = [...byTime.values()];
  if (hits.length < 8) throw new Error('Choose a MIDI part with at least eight distinct attacks, or use a manual beat match.');
  const sample = hits.filter((_, i) => i % Math.max(1, Math.ceil(hits.length / 300)) === 0);
  const totalWeight = sample.reduce((sum, hit) => sum + hit.weight, 0);
  const evaluate = (offset, timeScale) => {
    if (Number.isFinite(chart.duration) && chart.duration * timeScale > 1200) return -Infinity;
    let score = 0, covered = 0;
    for (const hit of sample) {
      const position = Math.round((hit.time * timeScale - offset) * features.rate);
      if (position < 0 || position >= features.envelope.length) continue;
      score += features.envelope[position] * hit.weight; covered += hit.weight;
    }
    return covered < totalWeight * 0.75 ? -Infinity : score / totalWeight;
  };
  let best = [];
  const collect = candidate => {
    if (!Number.isFinite(candidate.score)) return;
    const near = best.findIndex(item => Math.abs(item.offset - candidate.offset) < 0.18 && Math.abs(item.timeScale - candidate.timeScale) < 0.012);
    if (near >= 0) { if (best[near].score >= candidate.score) return; best.splice(near, 1); }
    best.push(candidate); best.sort((a, b) => b.score - a.score); best.length = Math.min(10, best.length);
  };
  const scales = options.drift === false ? [current.timeScale] : Array.from({ length: 33 }, (_, i) => current.timeScale * (0.92 + i * 0.005)).filter(value => value >= 0.5 && value <= 2);
  for (let s = 0; s < scales.length; s++) {
    const timeScale = scales[s];
    for (let offset = Math.max(-300, current.offset - window); offset <= Math.min(300, current.offset + window); offset += 0.04) collect({ offset, timeScale, score: evaluate(offset, timeScale) });
    syncCancelled(options); options.progress?.(`Comparing MIDI attacks… ${Math.round((s + 1) / scales.length * 100)}%`); await syncYield();
  }
  const seeds = [...best]; best = [];
  for (const seed of seeds) {
    for (let step = options.drift === false ? 0 : -5; step <= (options.drift === false ? 0 : 5); step++) {
      const timeScale = seed.timeScale + step * current.timeScale * 0.001;
      if (timeScale < 0.5 || timeScale > 2) continue;
      for (let delta = -8; delta <= 8; delta++) {
        const offset = seed.offset + delta * 0.005;
        if (Math.abs(offset) <= 300) collect({ offset, timeScale, score: evaluate(offset, timeScale) });
      }
    }
    syncCancelled(options); await syncYield();
  }
  // A 0.1% ratio error is audible after several minutes. Refine the survivors
  // again at 0.01% without repeating the full offset search.
  if (options.drift !== false) {
    const fineSeeds = [...best]; best = [];
    for (const seed of fineSeeds) {
      for (let step = -6; step <= 6; step++) for (let delta = -6; delta <= 6; delta++) {
        const timeScale = seed.timeScale + step * current.timeScale * 0.0001, offset = seed.offset + delta * 0.005;
        if (timeScale >= Math.max(0.5, current.timeScale * 0.92) && timeScale <= Math.min(2, current.timeScale * 1.08) && Math.abs(offset) <= 300) collect({ offset, timeScale, score: evaluate(offset, timeScale) });
      }
      syncCancelled(options); await syncYield();
    }
  }
  const candidates = [];
  for (const item of best) if (!candidates.some(other => Math.abs(other.offset - item.offset) < 0.2)) candidates.push(item);
  if (!candidates.length || candidates[0].score < 0.2) throw new Error('No convincing match found. Try a manual beat match, then search within ±12 seconds.');
  return candidates.slice(0, 3).map(item => ({ ...item, offset: Math.round(item.offset * 1000) / 1000, timeScale: Math.round(item.timeScale * 100000) / 100000 }));
}
