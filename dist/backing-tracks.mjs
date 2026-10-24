import { validateAlignment } from './sync.mjs';
import { validateAudioRange } from './backing-range.mjs';
import { validateTimingMap } from './timing-map.mjs';
import { lyricText } from './lyrics.mjs';

export const backingIdPattern = /^[a-z0-9][a-z0-9-]{0,39}$/;
export function backingChoices(meta) {
  return meta.backingTracks ?? (meta.audioName ? [{id:'main',label:'Backing recording',audioName:meta.audioName,offset:meta.offset ?? 0,timeScale:meta.timeScale ?? 1,volume:meta.volume ?? .65,...validateAudioRange(meta)}] : []);
}
export function validateBackingTracks(tracks, defaultId) {
  if (!Array.isArray(tracks) || tracks.length > 6) throw new Error('Choose up to six backing tracks per song.');
  const ids = new Set();
  const checked = tracks.map(track => {
    if (!track || !backingIdPattern.test(track.id) || ids.has(track.id)) throw new Error('Each backing needs a unique identifier.');
    ids.add(track.id);
    for (const [field,limit] of [['label',80],['audioName',180]]) if (typeof track[field] !== 'string' || !track[field].trim() || track[field].length > limit || /[\u0000-\u001f]/.test(track[field])) throw new Error('Enter a name and choose an audio file for every backing.');
    if (!Number.isInteger(track.audioBytes) || track.audioBytes < 1 || track.audioBytes > 100*1024*1024) throw new Error('Each backing must be at most 100 MB.');
    if (!Number.isFinite(track.volume) || track.volume < 0 || track.volume > 1) throw new Error('Choose a backing volume between 0 and 100%.');
    const timingMap=validateTimingMap(track.timingMap);
    const lyrics=track.lyricsText===undefined?{}:{lyricsText:lyricText(track.lyricsText),lyricsClock:'midi',lyricsOffset:0};
    return {id:track.id,label:track.label.trim(),audioName:track.audioName.trim(),audioBytes:track.audioBytes,...validateAlignment(track.offset,track.timeScale),volume:track.volume,...validateAudioRange(track),...(timingMap?{timingMap}:{}),...lyrics};
  });
  if (checked.reduce((sum,track)=>sum+track.audioBytes,0) > 300*1024*1024) throw new Error('Backing tracks together must be at most 300 MB.');
  if (tracks.length ? !ids.has(defaultId) : defaultId !== null) throw new Error('Choose the default backing track.');
  return checked;
}
export function backingFileKind(id) { if (!backingIdPattern.test(id)) throw new Error('Invalid backing identifier.'); return 'audio-'+id; }
export function withBacking(meta, id = meta.defaultBackingId) {
  const choices = backingChoices(meta);
  const selected = choices.find(track=>track.id === (id || meta.defaultBackingId || choices[0]?.id));
  if (!selected) { if (id) throw new Error('Backing track not found.'); return {...meta,backingId:null}; }
  const {id:selectedId,label,...settings}=selected;
  const baseLyrics=meta.baseLyrics || {lyricsText:meta.lyricsText,lyricsClock:meta.lyricsClock,lyricsOffset:meta.lyricsOffset};
  return {...meta,...baseLyrics,...settings,baseLyrics,timingMap:settings.timingMap ?? null,audioStart:selected.audioStart ?? 0,audioEnd:selected.audioEnd ?? null,lyricsAlignment:meta.lyricsAlignment || {offset:meta.offset ?? 0,timeScale:meta.timeScale ?? 1,timingMap:meta.timingMap ?? null},backingId:selectedId};
}
