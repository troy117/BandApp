import { lyricText, parseLyricText } from './lyrics.mjs';

export function plainLyricLines(text) {
  const lines = lyricText(text).split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 2000 || lines.some(line => line.length > 1000)) throw new Error('Enter one short lyric line per row.');
  return lines;
}
const cueTimestamp = seconds => {
  const ms = Math.round(seconds * 1000);
  return String(Math.floor(ms / 3600000)).padStart(2, '0') + ':' + String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
};
export function markedLyricText(lines, marks, duration) {
  if (marks.length !== lines.length) throw new Error('Mark the start of every lyric line before applying.');
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1200) throw new Error('Use a backing recording under 20 minutes.');
  const cues = marks.map((mark, i) => {
    const end = mark.end ?? marks[i + 1]?.time ?? Math.min(duration, mark.time + 8);
    if (!Number.isFinite(mark.time) || !Number.isFinite(end) || mark.time < 0 || end <= mark.time || end > duration || i && mark.time <= marks[i - 1].time || marks[i + 1] && end > marks[i + 1].time) throw new Error('Mark lines in order, with each ending before the next line. Undo and seek to correct a mark.');
    return cueTimestamp(mark.time) + ' --> ' + cueTimestamp(end) + '\n' + lines[i];
  });
  const text = lyricText('WEBVTT\n\n' + cues.join('\n\n')); parseLyricText(text); return text;
}

export class LyricTiming {
  constructor(importer) {
    this.importer = importer; this.q = importer.q; this.marks = []; this.lines = [];
    const q = this.q;
    q('b-lyric-timing-start').onclick = () => importer.attempt(() => this.start());
    q('b-lyric-mark').onclick = () => importer.attempt(() => this.mark());
    q('b-lyric-end').onclick = () => importer.attempt(() => this.end());
    q('b-lyric-undo').onclick = () => { this.marks.pop(); this.render(); };
    q('b-lyric-timing-apply').onclick = () => importer.attempt(() => this.apply());
    q('b-lyric-plain').oninput = () => this.reset();
    globalThis.document?.addEventListener('visibilitychange', () => { if (document.hidden) this.pause?.(); });
  }
  pause() { this.q('b-lyric-audio').pause?.(); }
  reset() {
    this.pause?.(); this.marks = []; this.lines = []; this.q('b-lyric-player').hidden = true;
    this.q('b-lyric-audio').removeAttribute?.('src'); this.q('b-lyric-audio').load?.();
    if (this.url) URL.revokeObjectURL(this.url); this.url = null;
  }
  start() {
    const draft = this.importer.draft;
    if (!draft?.audioBytes || !draft.buffer || draft.pendingAudio) throw new Error('Load the matching backing recording before timing lyrics.');
    const lines = plainLyricLines(this.q('b-lyric-plain').value);
    this.reset(); this.importer.practice.stop(); this.lines = lines;
    this.url = URL.createObjectURL(new Blob([draft.audioBytes]));
    const audio = this.q('b-lyric-audio'); audio.src = this.url; audio.volume = Number(this.q('b-import-volume').value) / 100;
    this.q('b-lyric-player').hidden = false; this.render();
    this.q('b-import-state').textContent = 'Play the recording. Mark each line as the singer starts it; use End current line before instrumental gaps.';
  }
  mark() {
    if (this.marks.length >= this.lines.length) return;
    const time = this.q('b-lyric-audio').currentTime, previous = this.marks.at(-1);
    if (previous && (time <= previous.time || previous.end && time < previous.end)) throw new Error('Seek after the previous line, or undo its mark first.');
    this.marks.push({ time }); this.render();
  }
  end() {
    const previous = this.marks.at(-1), end = this.q('b-lyric-audio').currentTime;
    if (!previous || end <= previous.time) throw new Error('Mark a line start, then mark its end later in the recording.');
    previous.end = end; this.render();
  }
  render() {
    const count = this.marks.length;
    this.q('b-lyric-next-line').textContent = count < this.lines.length ? 'Next · ' + (count + 1) + '/' + this.lines.length + ': ' + this.lines[count] : 'All ' + count + ' lines marked. Review or apply the timing.';
    this.q('b-lyric-mark').disabled = count >= this.lines.length;
    this.q('b-lyric-undo').disabled = this.q('b-lyric-end').disabled = !count;
    this.q('b-lyric-timing-apply').disabled = count !== this.lines.length;
  }
  apply() {
    const text = markedLyricText(this.lines, this.marks, this.importer.draft.buffer.duration);
    this.pause?.(); this.q('b-lyrics-text').value = text; this.q('b-lyrics-clock').value = 'recording'; this.q('b-lyrics-offset').value = 0;
    this.q('b-import-state').textContent = 'Timed vocal part prepared. Preview Vocals, then publish the school song update to share it.';
  }
}
