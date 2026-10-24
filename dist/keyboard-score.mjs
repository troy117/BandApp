import { vocalStaffPosition } from './vocal-guide.mjs';
import { pitchName } from './instruments.mjs';

export function keyboardQuarterAt(points, time) {
  let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(points[mid].time<=time)lo=mid+1;else hi=mid;}
  const a=points[Math.max(0,lo-1)],b=points[lo];
  if(!a)return 0;return b?a.quarter+(time-a.time)/(b.time-a.time)*(b.quarter-a.quarter):a.quarter;
}
const pianoRhythms=[4,3,2,1.5,1,.75,2/3,.5,.375,1/3,.25,1/6,.125,1/12];
export function keyboardRhythm(duration) {
  const length=pianoRhythms.reduce((a,b)=>Math.abs(Math.log(duration/a))<Math.abs(Math.log(duration/b))?a:b);
  const dotted=[3,1.5,.75,.375].some(n=>Math.abs(n-length)<1e-5),triplet=[2/3,1/3,1/6,1/12].some(n=>Math.abs(n-length)<1e-5),base=dotted?length/1.5:triplet?length*1.5:length;
  return {length,hollow:base>=2,whole:base>=4,dotted,flags:base<1?Math.max(1,Math.min(3,Math.round(Math.log2(1/base)))):0,triplet};
}

// MIDI pitches and holds are retained; rhythm rounding affects engraving only.
export function keyboardNotation(chart) {
  const measures=(chart.measures || Array.from({length:chart.bars},(_,i)=>({bar:i+1,startQuarter:i*4,endQuarter:(i+1)*4,time:chart.beats.find(b=>b.bar===i+1)?.time ?? i*240/chart.bpm,endTime:chart.beats.find(b=>b.bar===i+2)?.time ?? chart.duration,numerator:4,denominator:4}))).map(m=>({...m,groups:[],rests:[]}));
  const points=[...chart.beats.filter(b=>Number.isFinite(b.quarter)).map(b=>({time:b.time,quarter:b.quarter})),...measures.flatMap(m=>[{time:m.time,quarter:m.startQuarter},{time:m.endTime,quarter:m.endQuarter}]),...(chart.tempos||[]).filter(p=>Number.isFinite(p.quarter)).map(p=>({time:p.time,quarter:p.quarter}))];
  const timeline=[...new Map(points.sort((a,b)=>a.time-b.time).map(p=>[p.time,p])).values()];
  const seen=new Set(),byBar=new Map(measures.map((m,index)=>[m.bar,index])), groups=new Map();
  for(const note of chart.notes){
    const id=note.time.toFixed(5)+':'+note.pitch;if(seen.has(id))continue;seen.add(id);
    const first=byBar.get(note.bar);if(first===undefined)continue;
    const raw=Number.isFinite(note.quarter)?note.quarter:keyboardQuarterAt(timeline,note.time),from=Math.round(raw*24)/24;
    const end=Math.max(from+1/24,Math.round(keyboardQuarterAt(timeline,Math.min(chart.duration,note.time+(note.duration || 60/chart.bpm/4)))*24)/24);
    const staff=note.pitch<60?'bass':'treble';
    let index=first;
    while(index<measures.length){const m=measures[index++];if(m.startQuarter>=end-1e-7)break;if(m.endQuarter<=from+1e-7)continue;
      const start=Math.max(from,m.startQuarter),stop=Math.min(end,m.endQuarter),key=m.bar+':'+staff+':'+start.toFixed(5);
      let group=groups.get(key);if(!group){group={quarter:start,staff,notes:[]};groups.set(key,group);m.groups.push(group);}
      group.notes.push({source:note,pitch:note.pitch,start,end:stop,tieIn:start>from+1e-6,tieOut:stop<end-1e-6,rhythm:keyboardRhythm(stop-start)});
    }
  }
  for(const m of measures){m.groups.sort((a,b)=>a.quarter-b.quarter);for(const staff of ['treble','bass']){
    const intervals=m.groups.filter(g=>g.staff===staff).flatMap(g=>g.notes.map(n=>[n.start,n.end])).sort((a,b)=>a[0]-b[0]);let cursor=m.startQuarter;
    const rest=(from,to)=>{while(to-from>=1/8-1e-7){const duration=Math.min(to-from,Math.max(1/24,Math.ceil(from+1e-7)-from)),rhythm=keyboardRhythm(duration);m.rests.push({quarter:from,staff,rhythm});from+=duration;}};
    if(!intervals.length)m.rests.push({quarter:(m.startQuarter+m.endQuarter)/2,staff,rhythm:{length:4,whole:true},full:true});
    else {for(const [start,end] of intervals){if(start>cursor+1/48)rest(cursor,start);cursor=Math.max(cursor,end);}if(cursor<m.endQuarter-1/48)rest(cursor,m.endQuarter);}
  }}
  return {measures,timeline};
}

export function keyboardScoreLayout(model,width,zoom=1) {
  const gutter=74*zoom,right=width-18,available=Math.max(100,right-gutter),rows=[];let pending=[],used=0;
  const finish=()=>{if(!pending.length)return;let left=gutter;const cells=pending.map(item=>{const cell={...item,left,width:available*item.minimum/used};left+=cell.width;return cell;});rows.push({index:rows.length,cells,start:cells[0].measure.startQuarter,end:cells.at(-1).measure.endQuarter});pending=[];used=0;};
  for(const measure of model.measures){const onsets=new Set(measure.groups.map(g=>g.quarter)).size,minimum=Math.min(available,Math.max(155*zoom,onsets*32*zoom+44*zoom));if(pending.length&&used+minimum>available)finish();pending.push({measure,minimum});used+=minimum;}finish();
  const rowHeight=284*zoom;return {rows,gutter,right,rowHeight,height:rows.length*rowHeight,zoom};
}
const pianoX=(cell,quarter)=>cell.left+20+(quarter-cell.measure.startQuarter)/(cell.measure.endQuarter-cell.measure.startQuarter)*(cell.width-38);
const pianoColor=note=>note.status==='hit'?'#99e5b9':note.status==='wrong'?'#f58c99':note.status==='miss'?'#839092':'#e6eade';

export class KeyboardFullScore {
  constructor(container,page,canvas){Object.assign(this,{container,page,canvas});this.context=canvas.getContext('2d');this.zoom=1;this.noteNames=false;this.follow=-1;}
  draw(chart,time,running) {
    const width=this.container.clientWidth,height=this.container.clientHeight;if(!width||!height)return;
    if(this.chart!==chart){this.chart=chart;this.model=keyboardNotation(chart);this.layout=null;this.container.scrollTop=0;this.follow=-1;}
    if(!this.layout||this.width!==width||this.layout.zoom!==this.zoom){this.width=width;const dense=this.model.measures.reduce((max,m)=>Math.max(max,new Set(m.groups.map(g=>g.quarter)).size),0);this.scoreWidth=Math.max(width,Math.min(2000,(dense*28+120)*this.zoom));this.layout=keyboardScoreLayout(this.model,this.scoreWidth,this.zoom);this.follow=-1;this.canvas.setAttribute('aria-label','Full piano grand staff: '+chart.bars+' bars, treble and bass clefs. Scroll to review the score; gold playhead follows playback.');}
    const layout=this.layout,z=layout.zoom,gap=11*z,beat=keyboardQuarterAt(this.model.timeline,Math.max(0,time));
    const active=layout.rows.find(r=>r.start<=beat&&beat<r.end)||layout.rows.at(-1);if(!active)return;
    this.page.style.height=Math.max(height,layout.height)+'px';
    this.page.style.width=this.scoreWidth+'px';
    if(running&&this.follow!==active.index){const top=active.index*layout.rowHeight;if(top<this.container.scrollTop||top+layout.rowHeight>this.container.scrollTop+height)this.container.scrollTop=Math.max(0,top-10);this.follow=active.index;}if(!running)this.follow=-1;
    const dpr=Math.min(2,globalThis.devicePixelRatio||1);if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';}
    const c=this.context;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.fillStyle='#142326';c.fillRect(0,0,width,height);c.translate(-(this.container.scrollLeft||0),0);
    const first=Math.max(0,Math.floor(this.container.scrollTop/layout.rowHeight)),last=Math.min(layout.rows.length-1,Math.floor((this.container.scrollTop+height)/layout.rowHeight));
    for(let ri=first;ri<=last;ri++){
      const row=layout.rows[ri],top=ri*layout.rowHeight-this.container.scrollTop,treble=top+112*z,bass=top+228*z,bottomFor=staff=>staff==='bass'?bass:treble;
      c.lineWidth=1;c.strokeStyle='#607b7a';for(const bottom of [treble,bass])for(let i=0;i<5;i++){const y=bottom-i*gap;c.beginPath();c.moveTo(30*z,y);c.lineTo(layout.right,y);c.stroke();}
      c.fillStyle='#d5dfd6';c.font=48*z+'px "Segoe UI Symbol",serif';c.fillText('𝄞',33*z,treble+2*z);c.font=36*z+'px "Segoe UI Symbol",serif';c.fillText('𝄢',34*z,bass-19*z);
      c.strokeStyle='#a2b7ad';c.beginPath();c.moveTo(25*z,treble-4*gap);c.lineTo(21*z,treble-4*gap);c.lineTo(21*z,bass);c.lineTo(25*z,bass);c.stroke();
      for(const cell of row.cells){const m=cell.measure,accidentals=new Map();c.font=11*z+'px system-ui';c.fillStyle='#b3c5bc';c.fillText('Bar '+(m.sourceBar??m.bar)+(m.pass>1?' · '+m.pass:''),cell.left+3,top+24*z);
        c.strokeStyle='#718986';c.beginPath();c.moveTo(cell.left,treble-4*gap);c.lineTo(cell.left,bass);c.stroke();
        if(cell===row.cells[0]||cell.measure.numerator!==row.cells[row.cells.indexOf(cell)-1]?.measure.numerator||cell.measure.denominator!==row.cells[row.cells.indexOf(cell)-1]?.measure.denominator){c.font='bold '+14*z+'px serif';for(const bottom of [treble,bass]){c.fillText(String(m.numerator),cell.left+3,bottom-25*z);c.fillText(String(m.denominator),cell.left+3,bottom-9*z);}}
        for(const rest of m.rests){const x=pianoX(cell,rest.quarter),y=bottomFor(rest.staff)-2*gap;c.fillStyle='#95a99f';c.strokeStyle='#95a99f';if(rest.rhythm.length>=2){c.fillRect(x-5*z,y+(rest.rhythm.whole?0:-5*z),10*z,5*z);}else {c.font=24*z+'px "Segoe UI Symbol",serif';c.fillText(rest.rhythm.flags?'𝄾':'𝄽',x-5*z,y+8*z);}}
        for(const group of m.groups){const x=pianoX(cell,group.quarter),bottom=bottomFor(group.staff),notes=[...group.notes].sort((a,b)=>a.pitch-b.pitch),positions=notes.map(n=>vocalStaffPosition(n.pitch).step+(group.staff==='bass'?12:0)),up=positions.reduce((a,b)=>a+b,0)/positions.length<4;
          let previousStep=-100,alternate=false;
          for(let ni=0;ni<notes.length;ni++){const note=notes[ni],pos=vocalStaffPosition(note.pitch),step=positions[ni],y=bottom-step*gap/2;alternate=step-previousStep===1?!alternate:false;previousStep=step;const nx=x+(alternate?10*z:0),color=pianoColor(note.source);c.strokeStyle=color;c.fillStyle=color;
            for(let line=-2;line>=step;line-=2){const ly=bottom-line*gap/2;c.beginPath();c.moveTo(nx-10*z,ly);c.lineTo(nx+10*z,ly);c.stroke();}for(let line=10;line<=step;line+=2){const ly=bottom-line*gap/2;c.beginPath();c.moveTo(nx-10*z,ly);c.lineTo(nx+10*z,ly);c.stroke();}
            const accKey=group.staff+':'+step,sharp=pos.sharp?1:0;if(!note.tieIn&&sharp!==(accidentals.get(accKey)||0)){c.font=17*z+'px "Segoe UI Symbol",serif';c.fillText(sharp?'♯':'♮',nx-20*z,y+5*z);}accidentals.set(accKey,sharp);
            c.beginPath();c.ellipse(nx,y,6*z,4*z,-.3,0,Math.PI*2);if(note.rhythm.hollow){c.lineWidth=1.7*z;c.stroke();c.lineWidth=1;}else c.fill();
            if(note.rhythm.dotted){c.beginPath();c.arc(nx+11*z,y-2*z,1.5*z,0,Math.PI*2);c.fill();}
            if(note.tieOut||note.tieIn){const tx=note.tieOut?cell.left+cell.width-4:x-2*z,fx=note.tieOut?nx+6*z:cell.left+3;c.beginPath();c.moveTo(fx,y+9*z);c.quadraticCurveTo((fx+tx)/2,y+22*z,tx,y+9*z);c.stroke();}
            if(this.noteNames){c.font=9*z+'px system-ui';c.fillText(pitchName(note.pitch),nx-8*z,y+(up?20:-12)*z);}
          }
          const rhythm=keyboardRhythm(Math.min(...notes.map(n=>n.end-n.start)));if(!rhythm.whole){const ys=positions.map(s=>bottom-s*gap/2),sx=x+(up?6:-6)*z,start=up?Math.max(...ys):Math.min(...ys),end=(up?Math.min(...ys)-30*z:Math.max(...ys)+30*z);c.strokeStyle='#d9e0cf';c.beginPath();c.moveTo(sx,start);c.lineTo(sx,end);c.stroke();for(let f=0;f<rhythm.flags;f++){const fy=end+(up?f*7:-f*7)*z;c.beginPath();c.moveTo(sx,fy);c.quadraticCurveTo(sx+15*z,fy+(up?9:-9)*z,sx+7*z,fy+(up?19:-19)*z);c.stroke();}if(rhythm.triplet){c.font=10*z+'px system-ui';c.fillStyle='#c7d1c2';c.fillText('3',sx+8*z,end+(up?-5:12)*z);}}
        }
        if(running&&row===active&&beat>=m.startQuarter&&beat<m.endQuarter){const x=pianoX(cell,beat);c.fillStyle='#e8c17b22';c.fillRect(x-4,treble-5*gap,8,bass-treble+6*gap);c.strokeStyle='#e8c17b';c.lineWidth=2;c.beginPath();c.moveTo(x,treble-5*gap);c.lineTo(x,bass+gap);c.stroke();c.lineWidth=1;}
      }
      c.strokeStyle='#718986';c.beginPath();c.moveTo(layout.right,treble-4*gap);c.lineTo(layout.right,bass);c.stroke();
      c.strokeStyle='#ffffff12';c.beginPath();c.moveTo(20,top+layout.rowHeight-1);c.lineTo(width-20,top+layout.rowHeight-1);c.stroke();
    }
    this.container.dataset.activeRow=String(active.index+1);
  }
}
