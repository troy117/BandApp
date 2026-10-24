import { vocalSummary, vocalCsv } from './vocal-performance.mjs';
import { escapeHtml } from './song-import.mjs';

export const vocalReportTime = n => Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
export function vocalPhraseSummary(report,start,end) {
  const frames=report.frames.filter(f=>f[1]>start&&f[0]<end).map(f=>{const ratio=(Math.min(end,f[1])-Math.max(start,f[0]))/(f[1]-f[0]);return [Math.max(start,f[0]),Math.min(end,f[1]),f[2],...f.slice(3,8).map(n=>n*ratio),f[8],f[9]];});
  return vocalSummary({...report,from:start,elapsed:end,frames});
}
const vocalReportPercent = n => Math.round(n)+'%';
const vocalReportSeconds = n => n.toFixed(1)+'s';
export class VocalReportView {
  constructor(owner) {
    this.owner=owner;this.q=owner.q;
    const panel=document.createElement('section');panel.id='vocal-report-detail';panel.hidden=true;
    panel.innerHTML=`<div class="report-timeline-tools"><h3>Your pitch through the song</h3><button id="vocal-report-in" class="button secondary" aria-label="Zoom in to pitch report">＋</button><button id="vocal-report-out" class="button secondary" aria-label="Zoom out of pitch report">−</button><button id="vocal-report-reset" class="text-button">Whole attempt</button></div><p class="vocal-report-legend"><span>🟢 On pitch</span><span>🟡 Too low</span><span>🔴 Too high</span><span>○ Quiet / unclear</span><span>Gray = not measured</span></p><canvas id="vocal-report-chart" aria-label="Pitch error through the song. Green band is on pitch. Points above it are sharp, points below it are flat. Quiet and unclear input appear along the bottom."></canvas><label id="vocal-report-pan-label">Timeline position<input id="vocal-report-pan" type="range" step=".1" min="0" value="0"></label><p id="vocal-report-window" class="report-footnote"></p><h3>Find a phrase to practice</h3><div id="vocal-report-phrases"></div><button id="vocal-report-more" class="text-button">Show more phrases</button><button id="vocal-report-restart" class="button secondary">Sing from the beginning</button>`;
    this.q('report-detail').before(panel);this.panel=panel;
    this.q('vocal-report-in').onclick=()=>this.zoom(2);this.q('vocal-report-out').onclick=()=>this.zoom(.5);this.q('vocal-report-reset').onclick=()=>{this.scale=1;this.start=this.report.from;this.render();};
    this.q('vocal-report-pan').oninput=()=>{this.start=Number(this.q('vocal-report-pan').value);this.render();};
    this.q('vocal-report-more').onclick=()=>{this.limit+=30;this.phrases();};
    this.q('vocal-report-phrases').onclick=event=>{const button=event.target.closest('[data-vocal-retry]');if(button)this.retry(Number(button.dataset.vocalRetry));};
    this.q('vocal-report-restart').onclick=()=>this.retry(0);
  }
  open(record,report) {
    this.record=record;this.report=report;this.start=report?.from||0;this.scale=1;this.limit=30;this.panel.hidden=!report;
    this.q('report-detail').hidden=true;this.q('report-title').textContent='Your voice, in focus.';
    this.q('report-subtitle').textContent=record.title+' · Vocals · '+(record.stopped?'Stopped attempt':'Song complete')+(report?' · '+vocalReportTime(report.from)+'–'+vocalReportTime(report.elapsed):'');
    const s=report?vocalSummary(report):record;
    this.q('report-stats').innerHTML=[[vocalReportPercent(s.accuracy),'on pitch'],[vocalReportSeconds(s.measuredSeconds),'vocal time measured'],[vocalReportPercent(s.coverage),'coverage of played melody'],[vocalReportSeconds(s.lowSeconds),'too low'],[vocalReportSeconds(s.highSeconds),'too high'],[vocalReportSeconds(s.quietSeconds+s.unclearSeconds),'quiet / unclear']].map(([number,label])=>'<div class="report-stat"><strong>'+number+'</strong><span>'+label+'</span></div>').join('');
    this.q('report-detail-help').textContent='On-pitch time ÷ measured vocal time, within ±35 cents. Quiet or unclear input counts as not on pitch. Rests, the first 80 ms of a note, mic-off gaps and future notes are excluded. '+(report?.anyOctave?'Your comfortable octave was accepted.':'The written octave was required.')+' No microphone audio was recorded.';
    this.q('report-message').textContent='';this.q('report-slower').hidden=true;this.q('report-next').hidden=true;this.q('download-report').hidden=!report;
    this.q('report-replay').disabled=!report;this.q('report-replay').textContent=record.stopped&&report?.elapsed<report?.duration?'Continue song':'Sing again';
    if(!this.owner.root.open)this.owner.root.showModal();this.owner.root.scrollTop=0;if(report){this.phrases();requestAnimationFrame(()=>this.render());}
  }
  length(){return Math.max(.1,this.report.elapsed-this.report.from)/this.scale;}
  zoom(factor){const mid=this.start+this.length()/2;this.scale=Math.max(1,Math.min(32,this.scale*factor));this.start=Math.max(this.report.from,Math.min(this.report.elapsed-this.length(),mid-this.length()/2));this.render();}
  render(){
    if(!this.report)return;
    this.q('vocal-report-pan-label').hidden=this.scale===1;this.q('vocal-report-pan').min=this.report.from;this.q('vocal-report-pan').max=Math.max(this.report.from,this.report.elapsed-this.length());this.q('vocal-report-pan').value=this.start;
    this.q('vocal-report-window').textContent=vocalReportTime(this.start)+'–'+vocalReportTime(this.start+this.length())+' · '+this.scale+'× · Above center = too high; below = too low. 100 cents is one semitone. Detail uses intervals up to 0.1 seconds; errors beyond ±200 cents sit at the chart edge.';
    this.draw();
  }
  phrases(){
    const phrases=this.report.phrases.length?this.report.phrases:[[this.report.from,this.report.elapsed,'Your vocal melody']];
    this.q('vocal-report-phrases').innerHTML=phrases.slice(0,this.limit).map(([start,end,text])=>{
      const s=vocalPhraseSummary(this.report,start,end),label=s.measuredSeconds>=.1?vocalReportPercent(s.accuracy)+' on pitch':'Not measured';
      return '<article class="vocal-report-phrase"><div><small>'+vocalReportTime(start)+'–'+vocalReportTime(end)+'</small><p>'+escapeHtml(text)+'</p><strong>'+label+'</strong><small>'+vocalReportSeconds(s.lowSeconds)+' low · '+vocalReportSeconds(s.highSeconds)+' high · '+vocalReportSeconds(s.quietSeconds+s.unclearSeconds)+' quiet / unclear · '+vocalReportPercent(s.coverage)+' measured</small></div><button class="button secondary" data-vocal-retry="'+start+'">Try phrase</button></article>';
    }).join('');this.q('vocal-report-more').hidden=phrases.length<=this.limit;
  }
  async retry(time){
    this.q('report-message').textContent='Opening your singing practice…';
    try{await this.owner.onPractice(this.record,this.report,{startBar:this.record.playbackStartBar||1,endBar:this.record.playbackStartBar||1},{vocalTime:time});this.owner.root.close();}
    catch(error){this.q('report-message').textContent=error.message;}
  }
  csv(){return vocalCsv(this.report);}
  draw(){
    if(!this.report||!this.owner.root.open)return;
    const canvas=this.q('vocal-report-chart'),rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(2,devicePixelRatio||1);if(!w||!h)return;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#102023';c.fillRect(0,0,w,h);
    const x=t=>44+(t-this.start)/this.length()*(w-58),y=n=>20+(200-Math.max(-200,Math.min(200,n)))/400*(h-75),bottom=h-28;
    c.fillStyle='#71d8a226';c.fillRect(44,y(35),w-58,y(-35)-y(35));
    for(const n of [-200,-100,0,100,200]){c.strokeStyle=n===0?'#a7c7bb':'#375052';c.beginPath();c.moveTo(44,y(n));c.lineTo(w-14,y(n));c.stroke();c.fillStyle='#b4c9c6';c.font='10px system-ui';c.fillText((n>0?'+':'')+n,4,y(n)+3);}
    c.save();c.beginPath();c.rect(44,0,w-58,h);c.clip();
    for(const t of this.report.targets){if(t[1]<this.start||t[0]>this.start+this.length())continue;c.fillStyle='#496065';c.fillRect(x(Math.max(t[0],this.report.from)),bottom,Math.max(1,x(Math.min(t[1],this.report.elapsed))-x(Math.max(t[0],this.report.from))),7);}
    const colors=['#8de2ae','#e8c17b','#f58c99','#779297','#a7acb0'];
    for(const f of this.report.frames){if(f[1]<this.start||f[0]>this.start+this.length())continue;const durations=f.slice(3,8),total=durations.reduce((a,b)=>a+b,0),voiced=durations[0]+durations[1]+durations[2],index=durations.indexOf(Math.max(...durations));
      c.fillStyle=colors[index];if(voiced&&f[8]!==null){c.beginPath();c.arc((x(f[0])+x(f[1]))/2,y(f[8]),2.5,0,Math.PI*2);c.fill();}else{c.strokeStyle=colors[index];c.beginPath();c.arc((x(f[0])+x(f[1]))/2,h-44,2,0,Math.PI*2);c.stroke();}
      let at=f[0];for(let i=0;i<5;i++){const end=at+durations[i]/Math.max(total,1e-9)*(f[1]-f[0]);c.fillStyle=colors[i];c.fillRect(x(at),bottom,Math.max(0,x(end)-x(at)),7);at=end;}
    }
    c.restore();c.fillStyle='#bdd4ce';c.font='10px system-ui';c.fillText(vocalReportTime(this.start),44,h-7);c.fillText(vocalReportTime(this.start+this.length()),w-48,h-7);
  }
}
