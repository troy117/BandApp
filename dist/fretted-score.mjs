import { pitchName } from './instruments.mjs';
import {drawTabTechnique} from './fretted-parts.mjs';
import { reportMeasures } from './run-report.mjs';

export function frettedScoreLayout(chart, width) {
  const available=Math.max(170,width-80), measures=reportMeasures(chart), rows=[];
  let pending=[],used=0,noteIndex=0,beatIndex=0;
  const finish=()=>{if(!pending.length)return;const ratio=available/used;let left=58;const cells=pending.map(item=>{const cell={...item,left,width:item.minimum*ratio};left+=cell.width;return cell;});rows.push({index:rows.length,cells,start:cells[0].measure[0],end:cells.at(-1).measure[1]});pending=[];used=0;};
  for(const measure of measures){const notes=[],beats=[];while(noteIndex<chart.notes.length&&chart.notes[noteIndex].time<measure[1]-1e-8){const note=chart.notes[noteIndex++];if(note.time>=measure[0]-1e-8)notes.push(note);}while(beatIndex<chart.beats.length&&chart.beats[beatIndex].time<measure[1]-1e-8){const beat=chart.beats[beatIndex++];if(beat.time>=measure[0]-1e-8)beats.push(beat);}const onsets=new Set(notes.map(n=>n.time.toFixed(5))).size;const minimum=Math.min(available,Math.max(160,onsets*27+28));if(pending.length&&used+minimum>available)finish();pending.push({measure,minimum,notes,beats});used+=minimum;}
  finish();const rowHeight=chart.tuning.length*20+60;return {rows,rowHeight,height:rows.length*rowHeight};
}
export class FrettedFullScore {
  constructor(container,page,canvas){Object.assign(this,{container,page,canvas});this.context=canvas.getContext('2d');this.follow=-1;}
  draw(chart,time,running){
    const width=this.container.clientWidth,height=this.container.clientHeight;if(!width||!height)return;
    if(this.chart!==chart||this.width!==width){this.chart=chart;this.width=width;this.layout=frettedScoreLayout(chart,width);this.container.scrollTop=0;this.follow=-1;this.canvas.setAttribute('aria-label','Full '+chart.kind+' tablature: '+chart.bars+' bars across '+this.layout.rows.length+' rows. Follow the gold play bar.');}
    this.page.style.height=Math.max(height,this.layout.height)+'px';
    const active=this.layout.rows.find(row=>row.start<=Math.max(0,time)&&row.end>Math.max(0,time))||this.layout.rows.at(-1);
    if((running||time!==this.lastTime)&&active&&this.follow!==active.index){const top=active.index*this.layout.rowHeight;if(top<this.container.scrollTop||top+this.layout.rowHeight>this.container.scrollTop+height)this.container.scrollTop=Math.max(0,top-18);this.follow=active.index;}this.lastTime=time;if(!running)this.follow=-1;
    const dpr=Math.min(2,globalThis.devicePixelRatio||1);if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';}
    const c=this.context;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.fillStyle='#142326';c.fillRect(0,0,width,height);
    const scroll=this.container.scrollTop,colors=['#e8c17b','#74dcca','#c4a5ef','#f29b94','#91b8f5','#d2d5af'];
    for(const row of this.layout.rows){const y=row.index*this.layout.rowHeight-scroll;if(y+this.layout.rowHeight<0||y>height)continue;const top=y+42,bottom=top+(chart.tuning.length-1)*20;
      for(let string=0;string<chart.tuning.length;string++){c.strokeStyle='#4a6369';c.beginPath();c.moveTo(58,top+string*20);c.lineTo(width-22,top+string*20);c.stroke();c.font='11px system-ui';c.fillStyle=colors[string];c.fillText((string+1)+' '+pitchName(chart.tuning[string]).replace(/-?\d+$/,''),12,top+string*20+4);}
      for(const cell of row.cells){const [from,to,bar,pass]=cell.measure,xAt=at=>cell.left+12+(at-from)/(to-from)*(cell.width-24);c.fillStyle='#adc1c4';c.font='11px system-ui';c.fillText('Bar '+bar+(pass>1?' · '+pass:''),cell.left+3,y+20);c.strokeStyle='#668087';c.beginPath();c.moveTo(cell.left,top-10);c.lineTo(cell.left,bottom+10);c.stroke();
        for(const beat of cell.beats){if(beat.time<from||beat.time>=to)continue;const x=xAt(beat.time);c.strokeStyle='#294047';c.beginPath();c.moveTo(x,top-8);c.lineTo(x,bottom+8);c.stroke();}
        for(const note of cell.notes){if(note.time<from-1e-8||note.time>=to-1e-8)continue;const x=xAt(note.time);if(note.string===null){c.fillStyle='#f58c99';c.font='10px system-ui';c.fillText('? '+pitchName(note.pitch),x,bottom+24);continue;}const ny=top+note.string*20;c.strokeStyle=colors[note.string];const tail=xAt(Math.min(to,note.time+(note.duration||0)));if(tail>x){c.beginPath();c.moveTo(x,ny);c.lineTo(tail,ny);c.stroke();}c.fillStyle='#142326';c.fillRect(x-9,ny-8,18,16);c.fillStyle=colors[note.string];c.font='bold 12px system-ui';c.textAlign='center';c.fillText(note.muted?'×':note.ghost?'('+note.fret+')':note.fret,x,ny+4);c.textAlign='left';drawTabTechnique(c,note,chart.notes.find(n=>n.time>note.time&&n.string===note.string),x,ny,Math.min(cell.left+cell.width-5,tail),{color:colors[note.string]});}
        if(running&&time>=from&&time<to){c.strokeStyle='#e8c17b';c.lineWidth=2;c.strokeRect(xAt(time)-8,top-13,16,bottom-top+26);c.lineWidth=1;}
      }
    }
  }
}
