import { currentLyric } from './lyrics.mjs';

const clampKaraoke = value => Math.max(0, Math.min(1, value));
function karaokeBarPosition(chart, time) {
  const measures = chart.measures;
  if (!measures?.length) return time / (60 / chart.bpm * (chart.numerator || 4) * 4 / (chart.denominator || 4));
  const index = Math.max(0, measures.findLastIndex(measure => measure.time <= time)), measure = measures[index];
  const beats = chart.beats || [], beatIndex = Math.max(0, beats.findLastIndex(beat => beat.time <= time)), beat = beats[beatIndex], next = beats[beatIndex + 1];
  let fraction = (time - measure.time) / (measure.endTime - measure.time);
  if (Number.isFinite(beat?.quarter) && Number.isFinite(next?.quarter) && next.time > beat.time) {
    const quarter = beat.quarter + (next.quarter - beat.quarter) * (time - beat.time) / (next.time - beat.time);
    fraction = (quarter - measure.startQuarter) / (measure.endQuarter - measure.startQuarter);
  }
  return index + fraction;
}

export function karaokeFrame(chart, time, playing = true) {
  const cues = chart.lyrics || [], { current, next } = currentLyric(cues, time);
  if (!playing) return { phase: 'ready', label: 'READY TO SING', line: cues[0]?.text || 'No lyrics', next: cues[1]?.text || '', progress: 0 };
  if (current) return { phase: 'singing', label: 'SING', line: current.text, next: next?.text || '', progress: clampKaraoke((time - current.time) / (current.end - current.time)) };
  if (!next) return { phase: 'ended', label: 'VOCALS COMPLETE', line: 'End of vocals', next: '', progress: 0 };
  const remaining = Math.max(0, next.time - time), barsAway = karaokeBarPosition(chart, next.time) - karaokeBarPosition(chart, time);
  if (barsAway <= 2 + 1e-8) return { phase: 'preview', label: 'GET READY · ' + Math.ceil(remaining) + 's', line: next.text, next: cues[cues.indexOf(next) + 1]?.text || '', progress: 0 };
  const seconds = Math.ceil(remaining), countdown = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  return { phase: 'instrumental', label: time < 0 ? 'COUNT-IN' : 'INSTRUMENTAL', line: time < 0 ? 'Instrumental intro' : 'Instrumental break', next: 'Vocals in ' + countdown, progress: 0 };
}

// Saved cues currently time whole lines. Distribute the sweep through the text;
// do not claim to recover the singer's word or syllable timings from melody notes.
export function karaokeWordFills(text, progress) {
  const words = text.split(/\s+/).filter(Boolean), weights = words.map(word => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, '').length));
  const reached = clampKaraoke(progress) * weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return weights.map(weight => { const fill = clampKaraoke((reached - cursor) / weight); cursor += weight; return fill; });
}

export class KaraokeLyrics {
  constructor(q) { this.q = q; this.text = null; this.words = []; }
  draw(chart, time, playing) {
    const frame = karaokeFrame(chart, time, playing), line = this.q('b-vocal-line');
    this.q('b-lyrics-screen').dataset.phase = frame.phase;
    this.q('b-vocal-state').textContent = frame.label;
    if (this.text !== frame.line) {
      this.text = frame.line; this.words = []; line.replaceChildren();
      for (const token of frame.line.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) line.append(document.createTextNode(token));
        else { const word = document.createElement('span'); word.className = 'karaoke-word'; word.textContent = token; line.append(word); this.words.push(word); }
      }
    }
    const fills = karaokeWordFills(frame.line, frame.progress);
    this.words.forEach((word, index) => word.style.setProperty('--lyric-fill', (fills[index] * 100).toFixed(2) + '%'));
    const upcoming = frame.phase === 'instrumental' ? frame.next : frame.next ? 'Next · ' + frame.next : '';
    if (this.q('b-vocal-next').textContent !== upcoming) this.q('b-vocal-next').textContent = upcoming;
    this.q('b-vocal-progress').value = frame.progress;
    this.q('b-vocal-progress').hidden = frame.phase !== 'singing';
  }
}
