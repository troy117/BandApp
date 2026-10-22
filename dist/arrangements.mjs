import { createChart, DRUMS } from './engine.mjs';
import { makeMidiChart } from './midi.mjs';
import { alignMidiChart } from './sync.mjs';

export const DUETS = [
  { id: 'duet-first', title: 'Together on one · Level 1', bpm: 80, bars: 8, groove: 'rock', melody: [60, 60, 64, 64, 67, 67, 64, 60], step: 1, length: 0.7 },
  { id: 'duet-step', title: 'Step by step · Level 2', bpm: 90, bars: 8, groove: 'floor', melody: [60, 62, 64, 65, 67, 65, 64, 62], step: 0.5, length: 0.35 },
  { id: 'duet-long', title: 'Stay together · Endurance', bpm: 100, bars: 32, groove: 'rock', melody: [60, 64, 67, 72, 71, 67, 64, 62], step: 1, length: 0.7 },
];
export function builtinArrangement(id = 'duet-first') {
  const song = DUETS.find(item => item.id === id);
  if (!song) throw new Error('Choose a provided duet.');
  const drums = createChart(song.groove, song.bpm, song.bars), notes = [], beat = 60 / song.bpm;
  for (let quarter = 0, i = 0; quarter < song.bars * 4; quarter += song.step, i++) notes.push({ id: 'key-' + i, pitch: song.melody[i % song.melody.length], quarter, time: quarter * beat, duration: song.length * beat, velocity: 0.7, bar: Math.floor(quarter / 4) + 1, beat: quarter % 4 + 1, status: 'pending', actualTime: null, errorMs: null });
  const keyboard = { ...drums, kind: 'keyboard', title: song.title, notes };
  return { id: song.id, revisionId: 'duet-v1', title: song.title, sourceKind: 'duet', duration: drums.duration, bpm: song.bpm, parts: [{ id: 'drums', instrument: 'drums', name: 'Drums', chart: { ...drums, title: song.title } }, { id: 'keyboard', instrument: 'keyboard', name: 'Keyboard', chart: keyboard }], backing: null };
}
export function arrangementParts(input, legacySelected) {
  if (input === undefined) return [{ id: 'drums', instrument: 'drums', name: 'Drums', selected: [...legacySelected] }];
  if (!Array.isArray(input) || !input.length || input.length > 8) throw new Error('Choose between one and eight instrument parts.');
  const seen = new Set();
  return input.map(part => {
    if (!part || typeof part !== 'object' || !/^[a-z][a-z0-9-]{0,31}$/.test(part.id) || seen.has(part.id) || !['drums', 'keyboard'].includes(part.instrument) || typeof part.name !== 'string' || !part.name.trim() || part.name.length > 60 || /[\u0000-\u001f]/.test(part.name) || !Array.isArray(part.selected) || !part.selected.length || part.selected.length > 512 || !part.selected.every(id => typeof id === 'string' && /^\d{1,3}:\d{1,2}$/.test(id))) throw new Error('Invalid instrument part. Choose its instrument and MIDI tracks.');
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
  if (pianoOnly) return [{ id: 'keyboard', instrument: 'keyboard', name: 'Piano / Keyboard', selected: song.parts.map(part => part.id) }];
  const parts = [{ id: 'drums', instrument: 'drums', name: 'Drums', selected }];
  if (keyboard.length) parts.push({ id: 'keyboard', instrument: 'keyboard', name: 'Piano / Keyboard', selected: keyboard });
  return arrangementParts(parts);
}
export function importedArrangement(song, metadata = {}) {
  const parts = detectedArrangementParts(song, metadata);
  const timeScale = metadata.timeScale ?? 1;
  const charts = parts.map(part => {
    if (!part.selected.every(id => song.parts.some(candidate => candidate.id === id))) throw new Error('An assigned MIDI track is missing.');
    let chart;
    if (part.instrument === 'drums') chart = alignMidiChart(makeMidiChart(song, part.selected, metadata.mapping || {}), timeScale);
    else {
      const all = song.parts.filter(item => part.selected.includes(item.id)).flatMap(item => item.notes).sort((a, b) => a.tick - b.tick);
      const seen = new Set(), notes = [];
      for (const note of all) {
        const id = note.tick + ':' + note.pitch;
        if (seen.has(id)) continue; seen.add(id);
        const position = song.timeline.position(note.tick);
        notes.push({ id, pitch: note.pitch, time: song.timeline.tickToSeconds(note.tick), duration: song.timeline.tickToSeconds(note.endTick ?? note.tick + song.ppq / 4) - song.timeline.tickToSeconds(note.tick), quarter: note.tick / song.ppq, velocity: note.velocity / 127, bar: position.bar, beat: position.beat, status: 'pending', errorMs: null, actualTime: null });
      }
      if (!notes.length || notes.length > 50000) throw new Error('Choose a keyboard part with 1–50,000 notes.');
      // Reuse the exact tempo/meter construction, without converting pitched notes into drum identities.
      const rhythm = makeMidiChart(song, part.selected, Object.fromEntries(all.map(note => [note.pitch, 'snare'])));
      chart = alignMidiChart({ ...rhythm, kind: 'keyboard', notes }, timeScale);
      chart.notes.forEach(note => { note.duration *= timeScale; });
    }
    chart.title = metadata.title || song.title;
    return { ...part, chart };
  });
  return { id: metadata.id || song.fingerprint, revisionId: metadata.revisionId || song.fingerprint, title: metadata.title || song.title, sourceKind: metadata.id ? 'school' : 'personal', duration: charts[0].chart.duration, bpm: charts[0].chart.bpm, parts: charts, backing: null };
}
export function partSummary(judge) {
  const summary = judge.summary();
  return { total: summary.total, hits: summary.hits, misses: summary.misses, wrong: summary.wrong || 0, extras: summary.extras, bestStreak: summary.bestStreak, meanMs: summary.meanMs, meanAbsMs: summary.meanAbsMs, accuracy: summary.accuracy };
}
export function partCsv(judge) {
  const rows = [['instrument', 'expected', 'played', 'bar', 'beat', 'expected_seconds', 'actual_seconds', 'error_ms', 'result']];
  for (const note of judge.chart.notes) rows.push([note.pitch === undefined ? 'drums' : 'keyboard', note.drum ?? note.pitch, note.actualPitch ?? (note.status === 'hit' ? note.drum ?? note.pitch : ''), note.bar, note.beat, note.time, note.actualTime ?? '', note.errorMs ?? '', note.status]);
  for (const note of judge.extras) rows.push([note.pitch === undefined ? 'drums' : 'keyboard', '', note.drum ?? note.pitch, '', '', '', note.time, '', 'extra']);
  return rows.map(row => row.join(',')).join('\r\n');
}
