// Anchors relate unchanged MIDI seconds to original recording seconds.
export function validateTimingMap(value) {
  if (value === undefined || value === null) return null;
  if (!value || value.version !== 1 || !Array.isArray(value.points) || value.points.length < 2 || value.points.length > 4096) throw new Error('Choose a version 1 timing map with 2–4,096 anchors.');
  const points=value.points.map(point=>{
    if(!Array.isArray(point) || point.length!==2 || !point.every(Number.isFinite) || point[0]<0 || point[0]>1200 || point[1]<-300 || point[1]>1200)throw new Error('Timing anchors must contain valid MIDI and recording seconds.');
    return [...point];
  });
  if(points[0][0]!==0)throw new Error('A timing map must begin at MIDI second zero.');
  for(let i=1;i<points.length;i++){
    const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1];
    if(dx<.001 || dy<.001 || dy/dx<.1 || dy/dx>10)throw new Error('Timing anchors must move forward in both files without abrupt jumps.');
  }
  const source=typeof value.source==='string'?value.source.trim().slice(0,100):'Imported timing map';
  if(/[\u0000-\u001f]/.test(source))throw new Error('Invalid timing map source.');
  return {version:1,source,points};
}

function interpolate(points,value,column) {
  let lo=0,hi=points.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid][column]<=value)lo=mid;else hi=mid;}
  const a=points[lo],b=points[hi],other=1-column;
  return a[other]+(value-a[column])/(b[column]-a[column])*(b[other]-a[other]);
}
export function timingFunctions(alignment={}) {
  const map=validateTimingMap(alignment.timingMap),scale=alignment.timeScale ?? 1;
  if(!Number.isFinite(scale)||scale<.5||scale>2)throw new Error('Choose a MIDI speed between 50% and 200%.');
  if(!map)return {map:null,origin:0,forward:time=>time*scale,inverse:time=>time/scale};
  const origin=map.points[0][1];
  return {map,origin,forward:time=>interpolate(map.points,time,0)-origin,inverse:time=>interpolate(map.points,time+origin,1)};
}

export function chartQuarterAt(chart,time) {
  const tempo=chart.tempos.findLast(item=>item.time<=time)||chart.tempos[0];
  return tempo.quarter+(time-tempo.time)*tempo.bpm/60;
}

export function mapMidiChart(chart,alignment) {
  const timing=timingFunctions(alignment),map=timing.map;
  if(!map)return null;
  const forward=timing.forward,duration=forward(chart.duration);
  if(!Number.isFinite(duration)||duration<=0||duration>1200)throw new Error('The timing map must keep the song within 20 minutes.');
  if(map.points.at(-1)[0]<chart.duration-.001)throw new Error('The timing map must cover the entire MIDI arrangement.');
  const boundaries=[...new Set([0,...chart.tempos.map(item=>item.time),...map.points.map(point=>point[0])].filter(time=>time<chart.duration))].sort((a,b)=>a-b);
  const tempos=boundaries.map((time,i)=>{
    const end=boundaries[i+1]??chart.duration,quarter=chartQuarterAt(chart,time),endQuarter=chartQuarterAt(chart,end);
    return {time:forward(time),quarter,bpm:(endQuarter-quarter)*60/(forward(end)-forward(time))};
  });
  const bpm=tempos[0].bpm;
  return {...chart,timingMap:map,timeScale:1,duration,bpm,countInBeatSeconds:60/bpm*4/(chart.denominator||4),
    notes:chart.notes.map(note=>({...note,time:forward(note.time),...(Number.isFinite(note.duration)?{duration:forward(note.time+note.duration)-forward(note.time)}:{})})),
    beats:chart.beats.map(beat=>({...beat,time:forward(beat.time)})),tempos,
    signatures:chart.signatures.map(meter=>({...meter,time:forward(meter.time)})),
    measures:chart.measures.map(measure=>({...measure,time:forward(measure.time),endTime:forward(measure.endTime)}))};
}
