export const DRUM_DIFFICULTIES={
  beginner:{label:'Beginner',description:'Three lanes · steady pulse · simplest kick and snare'},
  easy:{label:'Easy',description:'Three lanes · eighth-note or swing pulse · fewer kicks'},
  intermediate:{label:'Intermediate',description:'Shorter fills · fewer kick bursts · simplified cymbals'},
  original:{label:'Original',description:'The complete imported drum part'},
};
export function validateDrumDifficulty(value='original'){
  if(!Object.hasOwn(DRUM_DIFFICULTIES,value))throw new Error('Choose Beginner, Easy, Intermediate or Original drums.');
  return value;
}
export function difficultyDrums(value='original'){
  validateDrumDifficulty(value);
  return value==='original'?null:value==='intermediate'?['kick','snare','hihat','hihat-open','ride','crash','tom3']:['kick','snare','hihat'];
}
const cymbals=new Set(['hihat','hihat-open','ride','crash']);
const toms=new Set(['tom1','tom2','tom3']);
const policies={intermediate:{subdivide:true,kickSeconds:.18,snareRatio:.4,toms:true},easy:{subdivide:true,kickSeconds:.28,snareRatio:.6,toms:false},beginner:{subdivide:false,kickSeconds:.42,snareRatio:.65,toms:false}};

function difficultyMeasures(chart){
  if(chart.measures?.length)return chart.measures;
  const starts=chart.beats.filter((b,i,all)=>!i||b.bar!==all[i-1].bar);
  return starts.map((b,i)=>({bar:b.bar,time:b.time,endTime:starts[i+1]?.time??chart.duration,numerator:chart.numerator,denominator:chart.denominator,startQuarter:b.quarter??(b.bar-1)*chart.numerator*4/chart.denominator}));
}
function difficultyQuarter(chart,note){
  if(Number.isFinite(note.quarter))return note.quarter;
  const tempo=chart.tempos?.findLast(t=>t.time<=note.time)||{quarter:0,time:0,bpm:chart.bpm};
  return (tempo.quarter||0)+(note.time-tempo.time)*tempo.bpm/60;
}
function reduceDrumLayer(chart,level){
  const policy=policies[level],measures=difficultyMeasures(chart),bars=measures.map(m=>({measure:m,notes:[]}));let index=0;
  for(const note of chart.notes){while(index+1<bars.length&&bars[index+1].measure.time<=note.time+1e-7)index++;bars[index]?.notes.push(note);}
  const result=[];
  for(const {measure:m,notes}of bars){
    if(!notes.length)continue;
    const compound=m.denominator===8&&m.numerator>=6&&m.numerator%3===0,pulse=compound?1.5:1;
    const position=n=>(difficultyQuarter(chart,n)-m.startQuarter+(m.beatOffset||0)*4/m.denominator)/pulse;
    const fraction=n=>{const p=position(n);return p-Math.floor(p);};
    const near=(a,b)=>Math.min(Math.abs(a-b),Math.abs(a-b+1),Math.abs(a-b-1));
    const handNotes=notes.filter(n=>cymbals.has(n.drum)||n.drum==='snare');
    const swung=!compound&&handNotes.filter(n=>near(fraction(n),2/3)<.06).length>Math.max(1,handNotes.filter(n=>near(fraction(n),.5)<.06).length*1.5);
    const handSlots=policy.subdivide?(compound?[0,1/3,2/3]:swung?[0,2/3]:[0,.5]):[0];
    const footSlots=level==='intermediate'?[0,.5]:[0];
    const grid=(n,slots)=>{
      const p=position(n),base=Math.floor(p);let best=null;
      for(const step of [-1,0,1])for(const slot of slots){const at=base+step+slot,distance=Math.abs(p-at);if(!best||distance<best.distance)best={at,distance};}
      return best.distance<=.065?best:null;
    };
    const snareVelocities=notes.filter(n=>n.drum==='snare').map(n=>n.velocity??.8).sort((a,b)=>a-b),strong=snareVelocities[Math.floor(snareVelocities.length*.75)]||.8;
    const groups=new Map();
    for(const source of notes){
      if(source.drum==='hihat-pedal'||!['kick','snare',...cymbals,...toms].includes(source.drum))continue;
      if(toms.has(source.drum)&&!policy.toms)continue;
      if(source.drum==='snare'&&(source.velocity??.8)<strong*policy.snareRatio)continue;
      const slots=source.drum==='kick'?footSlots:source.drum==='snare'&&level!=='intermediate'?[0]:handSlots,point=grid(source,slots);if(!point)continue;
      let drum=source.drum;
      if(cymbals.has(drum)&&level!=='intermediate')drum='hihat';
      if(toms.has(drum))drum='tom3';
      // One cymbal hand and one snare/tom hand; never three simultaneous hands.
      const family=drum==='kick'?'kick':cymbals.has(drum)?'cymbal':'hand';
      if(source.drum==='crash'&&level==='intermediate'&&Math.abs(point.at)>1e-6)continue;
      const key=family+':'+point.at.toFixed(5),rank=(source.drum==='snare'?3:source.drum==='crash'?2:1)+(source.velocity??.8)-point.distance*4;
      if(!groups.has(key)||groups.get(key).rank<rank)groups.set(key,{rank,note:{...source,drum,...(drum!==source.drum?{sourceDrum:source.sourceDrum||source.drum,midiPitch:drum==='hihat'?42:41}:{})}});
    }
    const chosen=[...groups.values()].map(g=>g.note).sort((a,b)=>a.time-b.time),retained=[];let lastKick=-Infinity,lastSnare=-Infinity;
    for(const note of chosen){if(note.drum==='kick'){if(note.time-lastKick<policy.kickSeconds-1e-7)continue;lastKick=note.time;}if(note.drum==='snare'&&level==='beginner'){const q=difficultyQuarter(chart,note);if(q-lastSnare<pulse*1.5-1e-7)continue;lastSnare=q;}retained.push(note);}
    // A fill-only bar becomes a single snare cue at an existing attack, not an
    // invented groove. Completely silent bars stay silent at every level.
    if(!retained.length){const n=notes.find(n=>n.drum==='snare'||toms.has(n.drum))||notes.find(n=>n.drum==='kick'||cymbals.has(n.drum));if(n)retained.push({...n,drum:toms.has(n.drum)?'snare':cymbals.has(n.drum)&&level!=='intermediate'?'hihat':n.drum,...(toms.has(n.drum)?{sourceDrum:n.drum,midiPitch:38}:cymbals.has(n.drum)&&level!=='intermediate'?{sourceDrum:n.drum,midiPitch:42}:{})});}
    result.push(...retained);
  }
  // Enforce kick spacing across bar and changing-meter boundaries too.
  let lastKick=-Infinity;
  return {...chart,notes:result.filter(n=>{if(n.drum!=='kick')return true;if(n.time-lastKick<policy.kickSeconds-1e-7)return false;lastKick=n.time;return true;})};
}
export function simplifyDrumChart(source,difficulty='original'){
  validateDrumDifficulty(difficulty);
  if(difficulty==='original')return source;
  if(!source.notes.every(n=>typeof n.drum==='string'))throw new Error('Choose a drum part to simplify.');
  let chart=source;
  for(const level of ['intermediate','easy','beginner']){chart=reduceDrumLayer(chart,level);if(level===difficulty)break;}
  return {...chart,drumDifficulty:difficulty,originalDrumNotes:source.originalDrumNotes??source.notes.length};
}
