export const STANDARD_STRINGS = {guitar:[64,59,55,50,45,40],bass:[43,38,33,28]};
export const DROP_D_STRINGS = {guitar:[64,59,55,50,45,38],bass:[43,38,33,26]};
export function validateFrettedPart(part) {
  if(!STANDARD_STRINGS[part.instrument]){
    if(part.tuning!==undefined||part.tablature!==undefined)throw new Error('Only guitar and bass parts can have tablature.');return {};
  }
  const extra={},tuning=part.tuning??STANDARD_STRINGS[part.instrument];
  if(!Array.isArray(tuning)||tuning.length!==STANDARD_STRINGS[part.instrument].length||!tuning.every((p,i)=>Number.isInteger(p)&&p>=12&&p<=88&&(!i||p<tuning[i-1])))throw new Error('Choose a valid tuning, from highest string to lowest.');
  if(part.tuning!==undefined)extra.tuning=[...tuning];
  if(part.tablature!==undefined){
    const score=part.tablature;
    if(!score||score.version!==1||!Array.isArray(score.notes)||!score.notes.length||score.notes.length>50000)throw new Error('Choose tablature with 1–50,000 notes.');
    const positions=new Set();
    const notes=score.notes.map((note,i)=>{
      if(!note||!Number.isFinite(note.time)||note.time<0||note.time>1200||i&&note.time<score.notes[i-1].time||!Number.isFinite(note.duration)||note.duration<=0||note.duration>1200||!Number.isInteger(note.string)||note.string<0||note.string>=tuning.length||!Number.isInteger(note.fret)||note.fret<0||note.fret>36||note.pitch!==tuning[note.string]+note.fret)throw new Error('Tablature notes must have ordered times and a pitch matching their string and fret.');
      const key=note.time.toFixed(6)+':'+note.string;if(positions.has(key))throw new Error('Two notes use the same string at the same time. Split layered guitar parts.');positions.add(key);
      const checked={time:note.time,duration:note.duration,pitch:note.pitch,string:note.string,fret:note.fret};
      for(const field of ['palmMute','muted','ghost'])if(note[field]!==undefined){if(typeof note[field]!=='boolean')throw new Error('Invalid tablature technique.');checked[field]=note[field];}
      if(note.slide!==undefined){if(!Number.isInteger(note.slide)||note.slide<1||note.slide>255)throw new Error('Invalid tablature slide.');checked.slide=note.slide;}
      return checked;
    });
    extra.tablature={version:1,notes};
  }
  return extra;
}

export function retunePart(part,tuning) {
  const changed={...part,tuning:[...tuning]};
  if(part.tablature)changed.tablature={version:1,notes:part.tablature.notes.map(note=>({...note,fret:note.pitch-tuning[note.string]}))};
  return {...changed,...validateFrettedPart(changed)};
}

export function tabTechnique(note,next) {
  if(!note.slide)return null;
  if(note.slide&192)return {label:'pick scrape',up:!!(note.slide&128)};
  if(note.slide&3)return {label:note.slide&2?'legato slide':'slide',up:next?next.pitch>note.pitch:true};
  return {label:note.slide&48?'slide in':'slide out',up:!!(note.slide&8||note.slide&16)};
}

export function drawTabTechnique(ctx,note,next,x,y,endX,{mutingY=y-16,color='#e8c17b'}={}) {
  if(note.palmMute){ctx.fillStyle=color;ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText('P.M.',x,mutingY);ctx.textAlign='left';}
  const slide=tabTechnique(note,next);if(!slide)return;
  const from=x+12,to=Math.max(from+9,Math.min(endX,x+50)),rise=slide.up?-5:5;
  ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(from,y-rise);
  if(slide.label==='pick scrape')for(let i=1;i<=8;i++)ctx.lineTo(from+(to-from)*i/8,y-rise+2*rise*i/8+(i%2?2:-2));
  else ctx.lineTo(to,y+rise);
  ctx.stroke();ctx.lineWidth=1;
  ctx.fillStyle=color;ctx.font='8px system-ui';ctx.fillText(slide.label==='pick scrape'?'scrape':slide.label==='legato slide'?'sl. leg.':'sl.',from,y-9);
}
