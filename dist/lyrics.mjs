import { timingFunctions } from './timing-map.mjs';
export const MAX_LYRIC_BYTES = 10000;
export function lyricText(value = '') {
  if (typeof value !== 'string' || new TextEncoder().encode(value).length > MAX_LYRIC_BYTES || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('Choose lyric text smaller than 10 KB.');
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
const lyricSeconds = value => {
  const fields = value.replace(',', '.').split(':').map(Number);
  if (fields.length < 2 || fields.length > 3 || fields.some(n => !Number.isFinite(n) || n < 0) || fields.at(-1) >= 60 || fields.length === 3 && fields[1] >= 60) throw new Error('Use timestamps such as [00:12.50] or 00:00:12.500.');
  return fields.reduce((sum, n) => sum * 60 + n, 0);
};
// Inline WebVTT timestamps retain the score's uneven word rhythms and rests.
function vttPayload(raw, time, end) {
  const tags = [...raw.matchAll(/<(\d[\d:]*[.,]\d+)>/g)];
  const clean = value => value.replace(/<[^>]*>/g, '');
  if (!tags.length) return { text: clean(raw).trim() };
  const segments = []; let cursor = 0, at = time, text = '';
  for (const tag of [...tags, { index: raw.length, 0: '', 1: null }]) {
    const until = tag[1] === null ? end : lyricSeconds(tag[1]);
    if (until < at || until > end) throw new Error('Word timestamps must increase within their lyric line.');
    const chunk = clean(raw.slice(cursor, tag.index));
    if (chunk.trim() && until <= at) throw new Error('Each timed word must have a positive duration.');
    segments.push({ start: text.length, stop: text.length + chunk.length, time: at, end: until });
    text += chunk; cursor = tag.index + tag[0].length; at = until;
  }
  const words = [...text.matchAll(/\S+/g)].map(match => {
    const start = match.index, stop = start + match[0].length;
    const spans = segments.filter(segment => segment.start < stop && segment.stop > start);
    return { text: match[0], time: spans[0].time, end: spans.at(-1).end };
  });
  return { text: text.trim(), words };
}

export function lyricWordTimings(cue) {
  if (cue.words?.length) return cue.words;
  const tokens = cue.text.split(/\s+/).filter(Boolean);
  const weights = tokens.map(text => Math.max(1, text.replace(/[^\p{L}\p{N}]/gu, '').length));
  const total = weights.reduce((sum, value) => sum + value, 0); let offset = 0;
  return tokens.map((text, index) => {
    const time = cue.time + (cue.end - cue.time) * offset / total;
    offset += weights[index];
    return { text, time, end: cue.time + (cue.end - cue.time) * offset / total };
  });
}
export function parseLyricText(value) {
  const text = lyricText(value), cues = [];
  if (!text.trim()) return cues;
  if (/-->/m.test(text)) {
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split('\n'), index = lines.findIndex(line => line.includes('-->'));
      if (index < 0) continue;
      const match = lines[index].match(/^\s*(\d[\d:]*[.,]\d+)\s+-->\s+(\d[\d:]*[.,]\d+)(?:\s.*)?$/);
      if (!match) throw new Error('Invalid VTT/SRT cue timing.');
      const time = lyricSeconds(match[1]), end = lyricSeconds(match[2]);
      if (end <= time) throw new Error('A lyric cue must end after it starts.');
      const payload = vttPayload(lines.slice(index + 1).join('\n'), time, end);
      if (payload.text) cues.push({ time, end, ...payload });
    }
  } else {
    for (const line of text.split('\n').filter(line => line.trim())) {
      if (/^\[(ar|ti|al|by|re|ve):/i.test(line)) continue;
      const tags = [...line.matchAll(/\[(\d+:\d{2}(?:\.\d{1,3})?)\]/g)], payload = line.replace(/\[[^\]]*\]/g, '').trim();
      if (!tags.length) throw new Error('Add a timestamp to each lyric line, for example [00:12.50]Your line. LRC, VTT and SRT are supported.');
      for (const tag of tags) if (payload) cues.push({ time: lyricSeconds(tag[1]), text: payload });
    }
  }
  cues.sort((a,b) => a.time - b.time);
  if (!cues.length || cues.length > 2000 || cues.some(cue => cue.time > 1200 || cue.end > 1200 || cue.text.length > 1000)) throw new Error('Choose lyrics with 1–2,000 short cues, within 20 minutes.');
  return cues;
}
export function midiLyricCues(song) {
  const tracks = new Map();
  for (const event of song.lyricEvents || []) {
    if (!tracks.has(event.track)) tracks.set(event.track, []);
    tracks.get(event.track).push(event);
  }
  const stream = [...tracks.values()].sort((a,b) => b.length - a.length)[0] || [];
  const cues = []; let current = null;
  for (const event of stream) {
    const raw = event.text.replace(/\r/g, '\n');
    if (!raw || raw.startsWith('@')) continue;
    const newLine = /^[\\/\n]/.test(raw), text = raw.replace(/^[\\/\n]+/, '').replace(/[\u0000-\u001f]/g, '');
    const time = song.timeline.tickToSeconds(event.tick);
    if (newLine || !current || time - current.last > 3 || current.text.length > 120) { current = { time, last: time, text: '' }; cues.push(current); }
    current.text += text; current.last = time;
    if (/\n$/.test(raw)) current = null;
  }
  return cues.filter(cue => cue.text.trim()).map(({time,text}) => ({time,text:text.trim()}));
}
export function formatLyricCues(cues) {
  return cues.map(cue => '[' + String(Math.floor(cue.time / 60)).padStart(2,'0') + ':' + (cue.time % 60).toFixed(3).padStart(6,'0') + ']' + cue.text.replace(/\n/g,' ')).join('\n');
}
export function arrangementLyrics(song, metadata = {}) {
  const clock = metadata.lyricsClock ?? 'midi', offset = metadata.lyricsOffset ?? 0;
  if (!['midi','recording'].includes(clock) || !Number.isFinite(offset) || Math.abs(offset) > 300) throw new Error('Choose the lyric clock and an adjustment within 300 seconds.');
  const cues = metadata.lyricsText === undefined ? midiLyricCues(song) : parseLyricText(metadata.lyricsText);
  const reference = metadata.lyricsAlignment || metadata, timing=timingFunctions(metadata), original=timingFunctions(reference);
  const at=clock==='midi' ? time=>timing.forward(time)+offset : time=>timing.forward(original.inverse(time+offset+(reference.offset??0)));
  const duration=timing.forward(song.duration);
  return cues.map((cue,i) => ({ time: at(cue.time), end: at(cue.end ?? cues[i+1]?.time ?? cue.time + 8), text: cue.text,
    ...(cue.words ? { words: cue.words.map(word => ({ ...word, time: at(word.time), end: at(word.end) })) } : {})
  })).filter(cue => cue.end > 0 && cue.time < duration).map(cue => ({...cue,time:Math.max(0,cue.time),end:Math.min(duration,cue.end),
    ...(cue.words ? { words: cue.words.filter(word => word.end > 0 && word.time < duration).map(word => ({...word,time:Math.max(0,word.time),end:Math.min(duration,word.end)})) } : {})
  })).filter(cue => cue.end > cue.time);
}
export function currentLyric(cues, time) {
  let index = -1;
  for (let i=0;i<cues.length && cues[i].time <= time;i++) if (time < cues[i].end) index = i;
  return { index, current: cues[index] || null, next: cues[index >= 0 ? index + 1 : cues.findIndex(cue => cue.time > time)] || null };
}
