import { createChart, DRUMS } from './engine.mjs';
import { makeMidiChart, midiTimeGrid } from './midi.mjs';
import { alignMidiChart } from './sync.mjs';
import { BAND_INSTRUMENTS, followInstrument, frettedChart } from './follow-along.mjs';
import { arrangementLyrics } from './lyrics.mjs';
import { vocalMelody, analyzedVocalMelody } from './vocal-guide.mjs';

export const DUETS = [
  { id: 'duet-first', title: 'Together on one · Level 1', bpm: 80, bars: 8, groove: 'rock', melody: [60, 60, 64, 64, 67, 67, 64, 60], step: 1, length: 0.7 },
  { id: 'duet-step', title: 'Step by step · Level 2', bpm: 90, bars: 8, groove: 'floor', melody: [60, 62, 64, 65, 67, 65, 64, 62], step: 0.5, length: 0.35 },
  { id: 'duet-long', title: 'Stay together · Endurance', bpm: 100, bars: 32, groove: 'rock', melody: [60, 64, 67, 72, 71, 67, 64, 62], step: 1, length: 0.7 },
  { id: 'band-first', title: 'Full band warm-up · Level 1', bpm:80, bars:8, groove:'rock', melody:[60,62,64,67,64,62,60,60], step:1, length:0.7, ensemble:true },
];
export function builtinArrangement(id = 'duet-first') {
  const song = DUETS.find(item => item.id === id);
  if (!song) throw new Error('Choose a provided duet.');
  const drums = createChart(song.groove, song.bpm, song.bars), notes = [], beat = 60 / song.bpm;
  for (let quarter = 0, i = 0; quarter < song.bars * 4; quarter += song.step, i++) notes.push({ id: 'key-' + i, pitch: song.melody[i % song.melody.length], quarter, time: quarter * beat, duration: song.length * beat, velocity: 0.7, bar: Math.floor(quarter / 4) + 1, beat: quarter % 4 + 1, status: 'pending', actualTime: null, errorMs: null });
  const keyboard = { ...drums, kind: 'keyboard', title: song.title, notes };
  const parts = [{ id: 'drums', instrument: 'drums', name: 'Drums', chart: { ...drums, title: song.title } }, { id: 'keyboard', instrument: 'keyboard', name: 'Keyboard', chart: keyboard }];
  if (song.ensemble) {
    const guitar = [], bass = [], chords = [[48,52,55,60,64],[45,52,57,60,64],[41,48,53,57,60],[43,50,55,59,67]];
    for(let bar=0;bar<song.bars;bar++) {
      for(const [i,pitch] of chords[bar%4].entries()) guitar.push({id:`g-${bar}-${i}`,pitch,time:bar*4*beat,quarter:bar*4,duration:3.5*beat,bar:bar+1,beat:1,status:'pending'});
      for(let b=0;b<4;b++)bass.push({id:`bass-${bar}-${b}`,pitch:chords[bar%4][0]-12,time:(bar*4+b)*beat,quarter:bar*4+b,duration:0.7*beat,bar:bar+1,beat:b+1,status:'pending'});
    }
    for(const [instrument,notes] of [['guitar',guitar],['bass',bass]])parts.push({id:instrument,instrument,name:BAND_INSTRUMENTS[instrument],chart:frettedChart({...drums,kind:instrument,notes},instrument)});
    parts.push({id:'vocals',instrument:'vocals',name:'Vocals',chart:{...drums,kind:'vocals',notes:notes.map(note=>({...note,id:'vocal-'+note.id})),lyrics:['Find the beat','Keep it steady','Listen to each other','Play together'].map((text,i)=>({text,time:i*8*beat,end:(i+1)*8*beat}))}});
  }
  return { id: song.id, revisionId: song.ensemble ? 'duet-v2' : 'duet-v1', title: song.title, sourceKind: 'duet', duration: drums.duration, bpm: song.bpm, parts, backing: null };
}
export function arrangementParts(input, legacySelected) {
  if (input === undefined) return [{ id: 'drums', instrument: 'drums', name: 'Drums', selected: [...legacySelected] }];
  if (!Array.isArray(input) || !input.length || input.length > 8) throw new Error('Choose between one and eight instrument parts.');
  const seen = new Set();
  return input.map(part => {
    if (!part || typeof part !== 'object' || !/^[a-z][a-z0-9-]{0,31}$/.test(part.id) || seen.has(part.id) || !Object.hasOwn(BAND_INSTRUMENTS,part.instrument) || typeof part.name !== 'string' || !part.name.trim() || part.name.length > 60 || /[\u0000-\u001f]/.test(part.name) || !Array.isArray(part.selected) || !part.selected.length && part.instrument !== 'vocals' || part.selected.length > 512 || !part.selected.every(id => typeof id === 'string' && /^\d{1,3}:\d{1,2}$/.test(id))) throw new Error('Invalid instrument part. Choose its instrument and MIDI tracks.');
    seen.add(part.id);
    return { id: part.id, instrument: part.instrument, name: part.name.trim(), selected: [...new Set(part.selected)] };
  });
}
export function detectedArrangementParts(song, metadata = {}) {
  // Explicit assignments always win, including a deliberate drum-only arrangement.
  if (metadata.parts !== undefined) return arrangementParts(metadata.parts, metadata.selected || song.selected);
  const selected = [...(metadata.selected || song.selected)];
  const keyboard = song.parts.filter(part => part.keyboardCandidate && !selected.includes(part.id)).map(part => part.id);
  const drums = selected.filter(id => song.parts.some(part => part.id === id && part.drumCandidate));
  // A piano-only MIDI has no percussion selection: avoid turning its notes into drums.
  const pianoOnly = !metadata.selected && !drums.length && song.parts.every(part => part.keyboardCandidate);
  const parts = pianoOnly
    ? [{ id: 'keyboard', instrument: 'keyboard', name: 'Piano / Keyboard', selected: song.parts.map(part => part.id) }]
    : [{ id: 'drums', instrument: 'drums', name: 'Drums', selected }];
  if (keyboard.length) parts.push({ id: 'keyboard', instrument: 'keyboard', name: 'Piano / Keyboard', selected: keyboard });
  for(const instrument of ['guitar','bass']) { const selected=song.parts.filter(part=>part[instrument+'Candidate'] && !parts.some(assigned=>assigned.selected.includes(part.id))).map(part=>part.id);if(selected.length)parts.push({id:instrument,instrument,name:BAND_INSTRUMENTS[instrument],selected}); }
  if(arrangementLyrics(song,metadata).length)parts.push({id:'vocals',instrument:'vocals',name:'Vocals',selected:[]});
  return arrangementParts(parts);
}
export function importedArrangement(song, metadata = {}) {
  const parts = detectedArrangementParts(song, metadata);
  const timeScale = metadata.timeScale ?? 1;
  const charts = parts.map(part => {
    if (!part.selected.every(id => song.parts.some(candidate => candidate.id === id))) throw new Error('An assigned MIDI track is missing.');
    let chart;
    if (part.instrument === 'vocals') {
      const lyrics = arrangementLyrics(song,metadata);
      if(!lyrics.length)throw new Error('Add timed lyrics for the vocals part. This MIDI may contain melody notes without words.');
      const grid=midiTimeGrid(song),notes=metadata.vocalNotes===undefined?vocalMelody(song,part.selected):analyzedVocalMelody(grid,metadata.vocalNotes);
      chart = { ...alignMidiChart({ ...grid, notes }, timeScale,metadata.timingMap), kind: 'vocals', lyrics };
      if(!metadata.timingMap)chart.notes.forEach(note => { note.duration *= timeScale; });
    } else if (part.instrument === 'drums') chart = alignMidiChart(makeMidiChart(song, part.selected, metadata.mapping || {}), timeScale,metadata.timingMap);
    else {
      const all = song.parts.filter(item => part.selected.includes(item.id)).flatMap(item => item.notes).sort((a, b) => a.tick - b.tick);
      const seen = new Set(), notes = [];
      for (const note of all) {
        const id = note.tick + ':' + note.pitch;
        if (seen.has(id)) continue; seen.add(id);
        const position = song.timeline.position(note.tick);
        notes.push({ id, pitch: note.pitch, time: song.timeline.tickToSeconds(note.tick), duration: song.timeline.tickToSeconds(note.endTick ?? note.tick + song.ppq / 4) - song.timeline.tickToSeconds(note.tick), quarter: note.tick / song.ppq, velocity: note.velocity / 127, bar: position.bar, beat: position.beat, status: 'pending', errorMs: null, actualTime: null });
      }
      if (!notes.length || notes.length > 50000) throw new Error('Choose an instrument part with 1–50,000 notes.');
      // Reuse the exact tempo/meter construction, without converting pitched notes into drum identities.
      chart = alignMidiChart({ ...midiTimeGrid(song), kind: part.instrument, notes }, timeScale,metadata.timingMap);
      if(!metadata.timingMap)chart.notes.forEach(note => { note.duration *= timeScale; });
      if(['guitar','bass'].includes(part.instrument))chart=frettedChart(chart,part.instrument);
    }
    chart.title = metadata.title || song.title;
    return { ...part, chart };
  });
  return { id: metadata.id || song.fingerprint, revisionId: metadata.revisionId || song.fingerprint, title: metadata.title || song.title, sourceKind: metadata.id ? 'school' : 'personal', duration: charts[0].chart.duration, bpm: charts[0].chart.bpm, parts: charts, backing: null };
}
export function partSummary(judge) {
  if(judge.followAlong)return {mode:'follow'};
  const summary = judge.summary();
  return { total: summary.total, hits: summary.hits, misses: summary.misses, wrong: summary.wrong || 0, extras: summary.extras, bestStreak: summary.bestStreak, meanMs: summary.meanMs, meanAbsMs: summary.meanAbsMs, accuracy: summary.accuracy };
}
export function partCsv(judge) {
  const rows = [['instrument', 'expected', 'played', 'bar', 'beat', 'expected_seconds', 'actual_seconds', 'error_ms', 'result']];
  for (const note of judge.chart.notes) rows.push([note.pitch === undefined ? 'drums' : 'keyboard', note.drum ?? note.pitch, note.actualPitch ?? (note.status === 'hit' ? note.drum ?? note.pitch : ''), note.bar, note.beat, note.time, note.actualTime ?? '', note.errorMs ?? '', note.status]);
  for (const note of judge.extras) rows.push([note.pitch === undefined ? 'drums' : 'keyboard', '', note.drum ?? note.pitch, '', '', '', note.time, '', 'extra']);
  return rows.map(row => row.join(',')).join('\r\n');
}
