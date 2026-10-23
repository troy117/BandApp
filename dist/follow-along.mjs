export const BAND_INSTRUMENTS = { drums:'Drums', keyboard:'Piano / Keyboard', guitar:'Guitar', bass:'Bass', vocals:'Vocals' };
export const followInstrument = instrument => ['guitar','bass','vocals'].includes(instrument);
export const STRING_TUNINGS = { guitar:[64,59,55,50,45,40], bass:[43,38,33,28] };
export class FollowCursor {
  constructor(chart) { this.chart = structuredClone(chart); this.followAlong = true; }
  advance() {}
  summary() { return { mode:'follow' }; }
}
export function frettedChart(chart, instrument) {
  const tuning = STRING_TUNINGS[instrument];
  if (!tuning) throw new Error('Choose guitar or bass.');
  const result = structuredClone(chart), groups = new Map(); let previous = 3;
  if(!result.measures)result.measures=Array.from({length:chart.bars||0},(_,i)=>({bar:i+1,time:i*4*60/chart.bpm,endTime:Math.min(chart.duration,(i+1)*4*60/chart.bpm)}));
  for (const note of result.notes) { const key = note.time.toFixed(6); if (!groups.has(key)) groups.set(key,[]); groups.get(key).push(note); }
  for (const chord of groups.values()) {
    const notes = [...chord].sort((a,b) => b.pitch-a.pitch); let states = [{used:0,choices:[],cost:0,frets:[]}];
    for (const note of notes) {
      const options = tuning.map((pitch,string) => ({string,fret:note.pitch-pitch})).filter(item => item.fret >= 0 && item.fret <= 24);
      const next = [];
      for (const state of states) for (const choice of [...options, {string:null,fret:null}]) {
        if (choice.string !== null && state.used & (1 << choice.string)) continue;
        const frets = choice.fret > 0 ? [...state.frets,choice.fret] : state.frets;
        const stretch = frets.length ? Math.max(...frets)-Math.min(...frets) : 0;
        next.push({used:state.used | (choice.string === null ? 0 : 1<<choice.string),choices:[...state.choices,choice],frets,cost:state.cost+(choice.string === null ? 1000 : choice.fret === 0 ? 0.2 : Math.abs(choice.fret-previous)*0.3+choice.fret*0.06)+Math.max(0,stretch-4)*3});
      }
      states = next.sort((a,b) => a.cost-b.cost).slice(0,48);
    }
    const best = states[0];
    notes.forEach((note,i) => Object.assign(note,best.choices[i]));
    if (best.frets.length) previous = Math.min(...best.frets);
  }
  result.tuning = [...tuning]; result.unmapped = result.notes.filter(note => note.string === null).length;
  return result;
}
