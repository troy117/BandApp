import { createPracticeChart } from './practice.mjs';

// Every performer uses the same source-bar boundary, including parts resting there.
export function arrangementFromBar(arrangement, startBar = 1) {
  const bars = arrangement.parts[0].chart.bars;
  if (!Number.isInteger(startBar) || startBar < 1 || startBar > bars) throw new Error('Choose a start bar between 1 and ' + bars + '.');
  if (startBar === 1) return arrangement;
  const parts = arrangement.parts.map(part => {
    const chart = createPracticeChart(part.chart, { enabled: true, startBar, endBar: bars, repeats: 1, focus: 'all' }, { allowEmpty: true });
    chart.sourceBars = bars;
    const from = chart.passes[0].from;
    if (part.chart.lyrics) chart.lyrics = part.chart.lyrics.filter(cue => cue.end > from).map(cue => ({ ...cue, time: Math.max(0, cue.time - from), end: Math.min(chart.duration, cue.end - from) })).filter(cue => cue.end > cue.time);
    return { ...part, chart };
  });
  return { ...arrangement, startBar, sourceBars: bars, duration: parts[0].chart.duration, bpm: parts[0].chart.bpm, parts };
}
