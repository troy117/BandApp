import { pitchName } from './instruments.mjs';
const STRING_COLORS = ['#e8c17b','#74dcca','#c4a5ef','#f29b94','#91b8f5','#d2d5af'];
export function drawFretted(context, width, height, chart, time, tab = false) {
  const tuning=chart.tuning, left=55, right=width-20, rows=tuning.length, top=55, bottom=height-40, gap=(bottom-top)/Math.max(1,rows-1);
  context.textAlign='left';context.fillStyle='#afc5c7';context.font='12px system-ui';
  context.fillText(tab?'TAB · follow the gold bar':'Fret numbers · play when they enter the gold box',12,20);
  const position=Math.max(0,Math.min(chart.duration-0.000001,time)),current=chart.measures.findIndex(measure=>measure.time<=position&&measure.endTime>position);
  const first=chart.measures[Math.max(0,current)]||{time:0,endTime:chart.duration,bar:1}, last=chart.measures[Math.min(chart.measures.length-1,Math.max(0,current)+1)]||first;
  const hitX=left+(right-left)*0.15, speed=(right-hitX)/4;
  const xAt=at=>tab?left+(at-first.time)/(last.endTime-first.time)*(right-left):hitX+(at-time)*speed;
  for(let s=0;s<rows;s++){
    const y=top+s*gap;context.strokeStyle='#547078';context.beginPath();context.moveTo(left,y);context.lineTo(right,y);context.stroke();
    context.fillStyle=STRING_COLORS[s];context.font='13px system-ui';context.fillText((s+1)+' '+pitchName(tuning[s]).replace(/-?\d+$/,''),9,y+4);
  }
  for(const beat of chart.beats){const x=xAt(beat.time);if(x<left||x>right)continue;context.strokeStyle=beat.downbeat?'#e8c17b77':'#32494f';context.beginPath();context.moveTo(x,top-16);context.lineTo(x,bottom+12);context.stroke();if(beat.downbeat){context.fillStyle='#afc5c7';context.font='11px system-ui';context.fillText('Bar '+beat.bar,x+3,top-22);}}
  for(const note of chart.notes){
    const x=xAt(note.time);if(x<left-20||x>right+20)continue;
    if(note.string===null){context.fillStyle='#f29b94';context.font='11px system-ui';context.fillText('? '+pitchName(note.pitch),x,height-9);continue;}
    const y=top+note.string*gap, active=time>=note.time && time<note.time+Math.min(0.3,note.duration||0.2);
    context.strokeStyle=STRING_COLORS[note.string];context.lineWidth=3;
    const tail=Math.min(right,xAt(note.time+Math.min(note.duration||0,3)));if(tail>x){context.beginPath();context.moveTo(x,y);context.lineTo(tail,y);context.stroke();}context.lineWidth=1;
    context.fillStyle=active?'#fff3c7':STRING_COLORS[note.string];context.fillRect(x-12,y-12,24,24);context.fillStyle='#102023';context.textAlign='center';context.font='bold 15px system-ui';context.fillText(String(note.fret),x,y+5);context.textAlign='left';
  }
  const cursor=tab?xAt(Math.max(0,time)):hitX;
  context.strokeStyle='#e8c17b';context.lineWidth=2;context.strokeRect(cursor-16,top-18,32,bottom-top+36);context.lineWidth=1;
}
