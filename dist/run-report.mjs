import { DRUMS } from './engine.mjs';

const reportStatuses = ['hit', 'miss', 'wrong'];
export function stoppedJudge(judge, time) {
  const copy = Object.assign(Object.create(Object.getPrototypeOf(judge)), judge);
  copy.chart = structuredClone(judge.chart);
  copy.chart.notes = copy.chart.notes.filter(note => note.time <= time + 1e-8 || note.status !== 'pending');
  for (const note of copy.chart.notes) if (note.status === 'pending') note.status = 'miss';
  copy.extras = structuredClone(judge.extras.filter(note => note.time <= time));
  return copy;
}
export function reportMeasures(chart) {
  if (chart.measures?.length) return chart.measures.map(measure => [measure.time, measure.endTime, measure.sourceBar ?? measure.bar, measure.pass ?? 1]);
  const starts = chart.beats.filter((beat, index, all) => !index || beat.bar !== all[index-1].bar);
  return starts.map((beat,index) => [beat.time, starts[index+1]?.time ?? chart.duration, beat.sourceBar ?? beat.bar, beat.pass ?? 1]);
}
export function makeRunReport(judge, { instrument = 'drums', elapsed = judge.chart.duration, stopped = false, offset = 0 } = {}) {
  const chart = judge.chart;
  return {
    version: 1, instrument, stopped, elapsed: Math.max(0, Math.min(chart.duration, elapsed)), duration: chart.duration,
    tolerance: judge.toleranceMs ?? 140, offset, planned: chart.notes.length, measures: reportMeasures(chart),
    // Compact tuples keep a long song's note detail practical to store and download.
    notes: chart.notes.map(note => [note.time, note.bar, note.beat, note.drum ?? note.pitch, note.status, note.errorMs ?? null, note.actualPitch ?? null, note.sourceBar ?? note.bar, note.pass ?? 1]),
    extras: judge.extras.map(note => [note.time, note.drum ?? note.pitch]),
  };
}
export function validateRunReport(value) {
  if (!value || value.version !== 1 || !['drums','keyboard'].includes(value.instrument) || typeof value.stopped !== 'boolean' || !Number.isFinite(value.duration) || value.duration <= 0 || value.duration > 1200 || !Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed > value.duration || ![70,100,140].includes(value.tolerance) || !Number.isFinite(value.offset) || Math.abs(value.offset)>200 || !Number.isInteger(value.planned) || value.planned < 1 || value.planned > 50000) throw new Error('Invalid note report settings.');
  if(value.sourceBars!==undefined && (!Number.isInteger(value.sourceBars)||value.sourceBars<1||value.sourceBars>100000))throw new Error('Invalid source bar count.');
  const voice = item => value.instrument === 'drums' ? DRUMS.some(drum => drum.id === item) : Number.isInteger(item) && item >= 0 && item <= 127;
  if (!Array.isArray(value.notes) || !value.notes.length || value.notes.length > 50000 || value.notes.some(note => !Array.isArray(note) || note.length !== 9 || !Number.isFinite(note[0]) || note[0] < 0 || note[0] > value.duration + 0.001 || ![note[1],note[7]].every(bar => Number.isInteger(bar) && bar>=1 && bar<=100000) || !Number.isFinite(note[2]) || note[2]<1 || note[2]>65 || !voice(note[3]) || !reportStatuses.includes(note[4]) || (note[4] !== 'miss' ? !Number.isFinite(note[5]) || Math.abs(note[5])>value.tolerance+0.001 : note[5]!==null) || note[6]!==null && (!Number.isInteger(note[6]) || note[6]<0 || note[6]>127) || !Number.isInteger(note[8]) || note[8]<1 || note[8]>8)) throw new Error('Invalid note report detail.');
  if (!Array.isArray(value.measures) || !value.measures.length || value.measures.length>100000 || value.measures.some((m,i) => !Array.isArray(m) || m.length!==4 || !Number.isFinite(m[0]) || !Number.isFinite(m[1]) || m[0]<0 || m[1]<=m[0] || m[1]>value.duration+0.001 || i && m[0]<value.measures[i-1][1]-0.001 || !Number.isInteger(m[2]) || m[2]<1 || m[2]>100000 || !Number.isInteger(m[3]) || m[3]<1 || m[3]>8)) throw new Error('Invalid report bars.');
  if (!Array.isArray(value.extras) || value.extras.length>100000 || value.extras.some(n=>!Array.isArray(n)||n.length!==2||!Number.isFinite(n[0])||n[0]<-0.2||n[0]>value.duration+0.2||!voice(n[1]))) throw new Error('Invalid extra notes.');
  if (value.stopped && value.notes.some(n=>n[0]>value.elapsed+value.tolerance/1000+0.001)) throw new Error('Stopped reports cannot grade future notes.');
  return structuredClone(value);
}
export function reportSelection(report, from, to) {
  const first=Math.min(from,to), last=Math.max(from,to);
  const measures=report.measures.filter(m=>m[1]>first && m[0]<=last && m[0]<=report.elapsed);
  return measures.length ? {startBar:Math.min(...measures.map(m=>m[2])),endBar:Math.max(...measures.map(m=>m[2]))} : null;
}
export function reportMeasureAt(report,time){let low=0,high=report.measures.length;while(low<high){const mid=(low+high)>>>1;if(report.measures[mid][1]<=time)low=mid+1;else high=mid;}return report.measures[Math.min(low,report.measures.length-1)];}
export function reportCsv(report) {
  return [['expected_seconds','bar','beat','note','result','error_ms','played_pitch','source_bar','pass'],...report.notes,...report.extras.map(([time,voice])=>[time,'','',voice,'extra','','','',''])].map(row=>row.join(',')).join('\r\n');
}
