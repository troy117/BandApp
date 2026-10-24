import { reportMeasures } from './run-report.mjs';

export const VOCAL_TOLERANCE = 35;
const vocalRound = n => Math.round(n * 1e6) / 1e6;
const vocalClamp = (n,a,b) => Math.max(a,Math.min(b,n));
const vocalFirstAfter = (items,time) => { let lo=0,hi=items.length;while(lo<hi){const m=(lo+hi)>>>1;if(items[m].end<=time)lo=m+1;else hi=m;}return lo; };

// Single, settled melody notes only. Overlaps and the first 80 ms of a new
// note receive the same grace as the live pitch guide. Rests never count.
export function vocalWindows(chart) {
  const events=[];
  chart.notes.forEach((note,id)=>{
    if(!Number.isFinite(note.pitch)||!Number.isFinite(note.duration)||note.duration<=0)return;
    const time=vocalClamp(note.time,0,chart.duration),end=vocalClamp(note.time+note.duration,0,chart.duration);
    if(end<=time)return;
    events.push({at:time,id,note,kind:1},{at:end,id,kind:-1});
    if(time+.08<end)events.push({at:time+.08,kind:0});
  });
  events.sort((a,b)=>a.at-b.at);const active=new Map(),windows=[];
  for(let i=0;i<events.length;){
    const time=events[i].at;
    while(i<events.length&&events[i].at===time){const e=events[i++];if(e.kind===1)active.set(e.id,e.note);else if(e.kind===-1)active.delete(e.id);}
    const end=events[i]?.at;if(!(end>time)||!active.size)continue;
    const notes=[...active.values()],pitches=new Set(notes.map(n=>n.pitch)),first=notes[0];
    if(pitches.size!==1||time<first.time+.08-1e-8)continue;
    const previous=windows.at(-1);
    if(previous&&previous.pitch===first.pitch&&Math.abs(previous.end-time)<1e-8)previous.end=end;
    else windows.push({time,end,pitch:first.pitch});
  }
  return windows;
}

function vocalReportTargets(chart) {
  const measures=reportMeasures(chart);let bar=0;
  return vocalWindows(chart).map(w=>{while(bar+1<measures.length&&measures[bar][1]<=w.time)bar++;return [vocalRound(w.time),vocalRound(w.end),w.pitch,measures[bar]?.[2]||1];});
}
const vocalOverlap = (a,b,c,d) => Math.max(0,Math.min(b,d)-Math.max(a,c));
export function vocalSummary(report) {
  const totals=Array(5).fill(0);let cents=0,absolute=0;
  for(const f of report.frames){for(let i=0;i<5;i++)totals[i]+=f[i+3];const voiced=f[3]+f[4]+f[5];cents+=(f[8]||0)*voiced;absolute+=(f[9]||0)*voiced;}
  const measuredSeconds=totals.reduce((a,b)=>a+b,0),heardSeconds=totals[0]+totals[1]+totals[2];
  const targetSeconds=report.targets.reduce((sum,t)=>sum+vocalOverlap(t[0],t[1],report.from,report.elapsed),0),plannedSeconds=report.targets.reduce((sum,t)=>sum+t[1]-t[0],0);
  return {accuracy:measuredSeconds?totals[0]/measuredSeconds*100:0,onSeconds:totals[0],lowSeconds:totals[1],highSeconds:totals[2],quietSeconds:totals[3],unclearSeconds:totals[4],measuredSeconds,heardSeconds,targetSeconds,plannedSeconds,coverage:targetSeconds?Math.min(100,measuredSeconds/targetSeconds*100):0,songCoverage:plannedSeconds?Math.min(100,measuredSeconds/plannedSeconds*100):0,meanCents:heardSeconds?cents/heardSeconds:null,meanAbsCents:heardSeconds?absolute/heardSeconds:null};
}

export class VocalPerformance {
  constructor(chart,{from=0,anyOctave=true,delayMs=80}={}) {
    this.chart=chart;this.from=vocalClamp(from,0,chart.duration);this.anyOctave=anyOctave;this.delayMs=delayMs;
    this.targets=vocalReportTargets(chart);this.cells=[];this.cursor=this.from;
    for(const [start,end,pitch] of this.targets)for(let t=Math.max(start,this.from);t<end-1e-8;){
      const stop=Math.min(end,(Math.floor((t+1e-8)*10)+1)/10);
      this.cells.push({time:t,end:stop,pitch,counts:[0,0,0,0,0],cents:0,absolute:0});t=stop;
    }
  }
  disconnect(){this.previous=null;}
  observe(time,detection,enabled=true) {
    if(!enabled||!Number.isFinite(time)||time<this.from||time>this.chart.duration){this.disconnect();return;}
    const previous=this.previous;this.previous={time,detection};
    if(!previous||time<=previous.time||time-previous.time>.25){this.cursor=Math.max(this.cursor,time);return;}
    const start=Math.max(this.cursor,previous.time,this.from),end=Math.min(time,this.chart.duration);this.cursor=Math.max(this.cursor,time);
    for(let i=vocalFirstAfter(this.cells,start);i<this.cells.length&&this.cells[i].time<end;i++){
      const cell=this.cells[i],seconds=vocalOverlap(start,end,cell.time,cell.end);if(!seconds)continue;
      const d=previous.detection;let state=3,cents=null;
      if(d?.clipped)state=4;
      else if(d&&d.confidence>=.85&&Number.isFinite(d.midi)){
        const pitch=cell.pitch+(this.anyOctave?12*Math.round((d.midi-cell.pitch)/12):0);
        cents=(d.midi-pitch)*100;state=Math.abs(cents)<=VOCAL_TOLERANCE?0:cents<0?1:2;
      }
      cell.counts[state]+=seconds;if(cents!==null){cell.cents+=cents*seconds;cell.absolute+=Math.abs(cents)*seconds;}
    }
  }
  report(elapsed,stopped=true) {
    elapsed=vocalClamp(elapsed,this.from,this.chart.duration);
    const frames=this.cells.filter(c=>c.time<elapsed&&c.counts.some(n=>n>1e-8)).flatMap(c=>{
      const start=vocalRound(c.time),end=vocalRound(Math.min(c.end,elapsed)),counts=c.counts.map(vocalRound);
      if(end<=start||!counts.some(n=>n>0))return [];
      const voiced=c.counts[0]+c.counts[1]+c.counts[2],hasVoice=counts[0]+counts[1]+counts[2]>0;
      return [[start,end,c.pitch,...counts,hasVoice?vocalRound(c.cents/voiced):null,hasVoice?vocalRound(c.absolute/voiced):null]];
    });
    return {version:2,instrument:'vocals',duration:this.chart.duration,from:this.from,elapsed,stopped,anyOctave:this.anyOctave,delayMs:this.delayMs,tolerance:VOCAL_TOLERANCE,targets:this.targets,frames,phrases:(this.chart.lyrics||[]).filter(c=>c.end>this.from&&c.time<elapsed).map(c=>[Math.max(this.from,c.time),Math.min(elapsed,c.end),c.text])};
  }
}

export function validateVocalReport(value,chart) {
  if(!value||value.version!==2||value.instrument!=='vocals'||typeof value.stopped!=='boolean'||typeof value.anyOctave!=='boolean'||value.tolerance!==VOCAL_TOLERANCE||!Number.isFinite(value.duration)||value.duration<=0||value.duration>1200||!Number.isFinite(value.from)||value.from<0||!Number.isFinite(value.elapsed)||value.elapsed<=value.from||value.elapsed>value.duration||!Number.isFinite(value.delayMs)||value.delayMs<0||value.delayMs>300)throw new Error('Invalid vocal report settings.');
  if(!Array.isArray(value.targets)||value.targets.length>50000||!value.targets.length)throw new Error('Invalid vocal melody detail.');
  for(let i=0;i<value.targets.length;i++){const t=value.targets[i];if(!Array.isArray(t)||t.length!==4||!t.every(Number.isFinite)||t[0]<0||t[1]<=t[0]||t[1]>value.duration+.000002||i&&t[0]<value.targets[i-1][1]-.000002||!Number.isInteger(t[2])||t[2]<0||t[2]>127||!Number.isInteger(t[3])||t[3]<1)throw new Error('Invalid vocal melody detail.');}
  if(chart&&(Math.abs(chart.duration-value.duration)>1e-8||JSON.stringify(vocalReportTargets(chart))!==JSON.stringify(value.targets)))throw new Error('The vocal report does not match the selected melody and backing.');
  if(!Array.isArray(value.frames)||!value.frames.length||value.frames.length>60000)throw new Error('Invalid vocal pitch detail.');
  let target=0;
  for(let i=0;i<value.frames.length;i++){
    const f=value.frames[i];while(target<value.targets.length&&value.targets[target][1]<=f?.[0])target++;const t=value.targets[target];
    if(!Array.isArray(f)||f.length!==10||!f.slice(0,8).every(Number.isFinite)||!t||f[0]<value.from-.000002||f[1]>value.elapsed+.000002||f[0]<t[0]-.000002||f[1]>t[1]+.000002||f[2]!==t[2]||f[1]<=f[0]||f[1]-f[0]>.100002||i&&f[0]<value.frames[i-1][1]-.000002||f.slice(3,8).some(n=>n<0)||f.slice(3,8).reduce((a,b)=>a+b,0)>f[1]-f[0]+.000006)throw new Error('Invalid vocal pitch detail.');
    const voiced=f[3]+f[4]+f[5];if(voiced?(!Number.isFinite(f[8])||!Number.isFinite(f[9])||f[9]<0||Math.abs(f[8])>f[9]+.001||f[9]>9600):(f[8]!==null||f[9]!==null))throw new Error('Invalid vocal pitch error.');
  }
  if(!Array.isArray(value.phrases)||value.phrases.length>2000||value.phrases.some(p=>!Array.isArray(p)||p.length!==3||!Number.isFinite(p[0])||!Number.isFinite(p[1])||p[0]<value.from||p[1]<=p[0]||p[1]>value.elapsed||typeof p[2]!=='string'||p[2].length>1000))throw new Error('Invalid vocal phrase detail.');
  if(chart){const phrases=(chart.lyrics||[]).filter(c=>c.end>value.from&&c.time<value.elapsed).map(c=>[Math.max(value.from,c.time),Math.min(value.elapsed,c.end),c.text]);if(JSON.stringify(phrases)!==JSON.stringify(value.phrases))throw new Error('The vocal phrases do not match this song.');}
  if(vocalSummary(value).measuredSeconds<.1)throw new Error('Sing through a vocal phrase with the microphone on before saving a report.');
  const {version,instrument,duration,from,elapsed,stopped,anyOctave,delayMs,tolerance,targets,frames,phrases}=value;
  return structuredClone({version,instrument,duration,from,elapsed,stopped,anyOctave,delayMs,tolerance,targets,frames,phrases});
}

export function vocalCsv(report) {
  return [['start_seconds','end_seconds','target_midi','on_pitch_seconds','low_seconds','high_seconds','quiet_seconds','unclear_seconds','mean_cents','mean_absolute_cents'],...report.frames].map(row=>row.join(',')).join('\r\n');
}

export function vocalPracticeRecord(arrangement,part,report,{id,at=Date.now()}={}) {
  const summary=vocalSummary(report);
  return {id,at,...summary,instrument:'vocals',partId:part.id,partName:part.name,title:arrangement.title,sourceKind:arrangement.sourceKind,sourceId:arrangement.id,revisionId:arrangement.revisionId,backingId:arrangement.backingId||null,playbackStartBar:arrangement.startBar||1,bpm:part.chart.bpm,endBpm:part.chart.tempos?.at(-1)?.bpm||part.chart.bpm,stopped:report.stopped,full:!report.stopped&&report.from===0,repeats:1,section:'1–'+part.chart.bars,focus:'vocals',grooveId:null,meanMs:null,meanAbsMs:null,reportAvailable:true};
}
