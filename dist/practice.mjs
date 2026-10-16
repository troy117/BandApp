import { DRUMS } from './engine.mjs';

export const FOCUS_OPTIONS = { all: 'All drums', kick: 'Kick only', snare: 'Snare only', cymbals: 'Cymbals only', toms: 'Toms only' };
const focusIds = focus => focus === 'all' ? DRUMS.map(drum => drum.id) : focus === 'cymbals' ? ['hihat', 'crash', 'ride'] : focus === 'toms' ? ['tom1', 'tom2', 'tom3'] : [focus];

export function createPracticeChart(source, options = {}) {
  const startBar = options.enabled ? Number(options.startBar) : 1;
  const endBar = options.enabled ? Number(options.endBar) : source.bars;
  const repeats = options.enabled ? Number(options.repeats) : 1;
  const focus = Object.hasOwn(FOCUS_OPTIONS, options.focus) ? options.focus : 'all';
  if (![startBar, endBar, repeats].every(Number.isInteger) || startBar < 1 || endBar < startBar || endBar > source.bars || ![1, 2, 4, 8].includes(repeats)) throw new Error('Choose valid start/end bars and 1, 2, 4, or 8 repeats.');
  const startBeat = source.beats.find(beat => beat.bar === startBar);
  const endBeat = source.beats.find(beat => beat.bar === endBar + 1);
  if (!startBeat) throw new Error('That section has no beat grid. Choose an earlier bar.');
  const from = startBeat.time, to = endBeat?.time ?? source.duration;
  const selected = focusIds(focus);
  const sourceNotes = source.notes.filter(note => note.time >= from - 1e-8 && note.time < to - 1e-8 && selected.includes(note.drum));
  if (!sourceNotes.length) throw new Error(`No ${focus === 'all' ? 'drum' : FOCUS_OPTIONS[focus].replace(' only', '').toLowerCase()} hits in this section. Choose another focus or a wider section.`);
  if (sourceNotes.length * repeats > 50000) throw new Error('Choose fewer repeats or a shorter section (50,000 hits maximum).');
  const barCount = endBar - startBar + 1;
  const increment = source.kind === 'groove' && options.enabled && repeats > 1 && options.stepUp ? 5 : 0;
  const initialBpm = source.tempos?.findLast(tempo => tempo.time <= from)?.bpm ?? source.bpm;
  const initialMeter = source.signatures?.findLast(meter => meter.time <= from) ?? source;
  const chart = { ...source, notes: [], beats: [], tempos: [], signatures: [], measures: source.measures ? [] : undefined, bars: barCount * repeats, passes: [], focusDrums: selected, practice: { startBar, endBar, repeats, focus, increment, full: startBar === 1 && endBar === source.bars }, bpm: initialBpm, numerator: initialMeter.numerator, denominator: initialMeter.denominator };
  const fromQuarter = source.measures?.find(measure => measure.bar === startBar)?.startQuarter;
  const toQuarter = source.measures?.find(measure => measure.bar === endBar)?.endQuarter;
  const quarterLength = toQuarter - fromQuarter;
  let cursor = 0;
  for (let pass = 0; pass < repeats; pass++) {
    const bpm = source.kind === 'groove' && increment ? Math.max(initialBpm, Math.min(160, initialBpm + pass * increment)) : initialBpm;
    const scale = source.kind === 'groove' ? initialBpm / bpm : 1;
    const duration = (to - from) * scale;
    chart.passes.push({ index: pass + 1, time: cursor, duration, bpm, from, to, scale, firstBar: pass * barCount + 1, bars: barCount });
    for (const note of sourceNotes) chart.notes.push({ ...note, ...(Number.isFinite(note.quarter) ? { quarter: pass * quarterLength + note.quarter - fromQuarter } : {}), id: `${pass}:${note.id}`, sourceBar: note.bar, pass: pass + 1, bar: pass * barCount + note.bar - startBar + 1, time: cursor + (note.time - from) * scale, status: 'pending', errorMs: null, actualTime: null });
    for (const beat of source.beats.filter(beat => beat.time >= from - 1e-8 && beat.time < to - 1e-8)) chart.beats.push({ ...beat, ...(Number.isFinite(beat.quarter) ? { quarter: pass * quarterLength + beat.quarter - fromQuarter } : {}), sourceBar: beat.bar, pass: pass + 1, bar: pass * barCount + beat.bar - startBar + 1, time: cursor + (beat.time - from) * scale });
    for (const measure of source.measures || []) if (measure.bar >= startBar && measure.bar <= endBar) chart.measures.push({ ...measure, sourceBar: measure.bar, pass: pass + 1, bar: pass * barCount + measure.bar - startBar + 1, startQuarter: pass * quarterLength + measure.startQuarter - fromQuarter, endQuarter: pass * quarterLength + measure.endQuarter - fromQuarter, time: cursor + (measure.time - from) * scale, endTime: cursor + (measure.endTime - from) * scale });
    const tempos = source.kind === 'groove' ? [{ time: from, bpm }] : [{ time: from, bpm: initialBpm }, ...source.tempos.filter(item => item.time > from && item.time < to)];
    const meters = [{ ...initialMeter, time: from }, ...(source.signatures || []).filter(item => item.time > from && item.time < to)];
    for (const tempo of tempos) chart.tempos.push({ time: cursor + (tempo.time - from) * scale, ...(Number.isFinite(tempo.quarter) ? { quarter: pass * quarterLength + tempo.quarter - fromQuarter } : {}), bpm: tempo.bpm });
    for (const meter of meters) chart.signatures.push({ time: cursor + (meter.time - from) * scale, numerator: meter.numerator, denominator: meter.denominator });
    cursor += duration;
  }
  if (cursor > 1200) throw new Error('Keep a practice run under 20 minutes. Choose fewer repeats or a shorter section.');
  chart.duration = cursor;
  if (chart.measures) chart.endQuarter = quarterLength * repeats;
  chart.countInBeats = chart.numerator;
  chart.countInBeatSeconds = 60 / initialBpm * 4 / chart.denominator;
  chart.tempoChanges = chart.tempos.filter((tempo, i, all) => i && tempo.bpm !== all[i - 1].bpm).length;
  chart.signatureChanges = chart.signatures.filter((meter, i, all) => i && (meter.numerator !== all[i - 1].numerator || meter.denominator !== all[i - 1].denominator)).length;
  return chart;
}

export function practicePassAt(chart, time) {
  return chart.passes?.findLast(pass => pass.time <= time) || chart.passes?.[0];
}

// Translate each selected MIDI section to its matching segment of the full recording.
// A positive recording offset is silence before the recording starts on the MIDI timeline.
export function backingSegments(chart, backing) {
  return chart.passes.flatMap(pass => {
    const fileStart = pass.from - backing.offset;
    const delay = Math.max(0, -fileStart);
    const offset = Math.max(0, fileStart);
    const duration = Math.min(pass.to - pass.from - delay, backing.buffer.duration - offset);
    return duration > 0 ? [{ when: pass.time + delay, offset, duration }] : [];
  });
}

export function passSummaries(judge) {
  const passes = judge.chart.passes || [];
  return passes.map((pass, i) => {
    const notes = judge.chart.notes.filter(note => note.pass === pass.index);
    const hits = notes.filter(note => note.status === 'hit');
    const extras = judge.extras.filter(extra => (practicePassAt(judge.chart, extra.time)?.index ?? 1) === pass.index).length;
    return { ...pass, total: notes.length, hits: hits.length, extras, accuracy: hits.length / (notes.length + extras) * 100, meanAbsMs: hits.length ? hits.reduce((sum, note) => sum + Math.abs(note.errorMs), 0) / hits.length : null };
  });
}

export function savePracticeHistory(previous, record) {
  const history = Array.isArray(previous) ? previous.filter(item => item && typeof item.title === 'string' && Number.isFinite(item.accuracy) && Number.isFinite(item.at)) : [];
  return [record, ...history].slice(0, 30);
}
