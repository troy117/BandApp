import { VocalReportView } from './vocal-report-view.mjs';
import { DRUMS } from './engine.mjs';
import { pitchName } from './instruments.mjs';
import { escapeHtml, formatDuration } from './song-import.mjs';
import { reportSelection, reportCsv, reportMeasureAt } from './run-report.mjs';

export class RunReportView {
  constructor(onPractice) {
    this.onPractice=onPractice;this.root=document.getElementById('report-dialog');this.q=id=>this.root.querySelector('#'+id);
    this.root.innerHTML=`<div class="dialog-header"><div><p class="eyebrow">EVERY ATTEMPT IS PROGRESS</p><h2 id="report-title">Your music, in focus.</h2></div><button id="report-close" class="close-button" aria-label="Close report">×</button></div>
      <p id="report-subtitle" class="dialog-description"></p><div id="report-stats" class="report-stats"></div><p id="report-detail-help" class="report-footnote"></p>
      <section id="report-detail"><div class="report-timeline-tools"><h3>Where your notes landed</h3><button id="report-zoom-in" class="button secondary" aria-label="Zoom in to report">＋</button><button id="report-zoom-out" class="button secondary" aria-label="Zoom out of report">−</button><button id="report-zoom-reset" class="text-button">Whole attempt</button><output id="report-zoom-label"></output></div>
      <label id="report-pan-label">Timeline position<input id="report-pan" type="range" min="0" step="0.01" value="0"></label>
      <p class="report-footnote">Drag across the chart to select bars. Green = matched, pink = wrong note, × = missed, gold = extra. Above zero is late; below zero is early.</p>
      <canvas id="timing-chart" aria-label="Note timing report. Drag to select bars, or use the From and Through bar fields." tabindex="0"></canvas>
      <div class="report-selection-controls"><label>From bar<input id="report-from" type="number" min="1" value="1"></label><label>Through bar<input id="report-to" type="number" min="1" value="1"></label><button id="report-practice" class="button primary">Add section to practice</button><span id="report-selection-label" role="status"></span></div>
      <div class="table-wrap report-note-table"><table><thead><tr><th>Source bar / beat</th><th>Expected</th><th>Result</th><th>Timing</th></tr></thead><tbody id="report-notes"></tbody></table></div><button id="report-more" class="text-button">Show more notes</button><details id="report-breakdown"><summary>Timing by drum and practice pass</summary><div id="report-breakdown-content"></div></details></section>
      <p id="report-message" role="status"></p><div class="dialog-actions"><button id="download-report" class="button secondary">Download CSV ↓</button><button id="report-replay" class="button primary">Play again</button><button id="report-slower" class="button secondary">Try 5 BPM slower</button><button id="report-next" class="button secondary">Explore next track →</button><button id="report-done" class="button secondary">Done</button></div>`;
    this.vocal=new VocalReportView(this);
    this.q('report-close').onclick=this.q('report-done').onclick=()=>this.root.close();
    this.q('report-zoom-in').onclick=()=>this.zoom(2);this.q('report-zoom-out').onclick=()=>this.zoom(0.5);this.q('report-zoom-reset').onclick=()=>{this.scale=1;this.start=0;this.render();};
    this.q('report-pan').oninput=()=>{this.start=Number(this.q('report-pan').value);this.limit=250;this.render();};
    for(const id of ['report-from','report-to'])this.q(id).oninput=this.q(id).onchange=()=>this.selectBars();
    this.q('report-more').onclick=()=>{this.limit+=250;this.table();};
    this.q('report-notes').onclick=event=>{const button=event.target.closest('[data-report-bar]');if(button){this.q('report-from').value=this.q('report-to').value=button.dataset.reportBar;this.selectBars();}};
    const canvas=this.q('timing-chart');
    canvas.onpointerdown=event=>{this.drag=this.timeAt(event);canvas.setPointerCapture(event.pointerId);};
    canvas.onpointermove=event=>{if(this.drag!==undefined)this.selectRange(this.drag,this.timeAt(event));};
    canvas.onpointerup=event=>{if(this.drag!==undefined)this.selectRange(this.drag,this.timeAt(event));this.drag=undefined;};canvas.onpointercancel=()=>{this.drag=undefined;};
    this.q('report-replay').onclick=()=>this.replay();this.q('report-slower').onclick=()=>this.replay(true);this.q('report-next').onclick=()=>this.replay(false,true);
    this.q('report-practice').onclick=async()=>{this.selectBars(false);if(!this.selection)return;const button=this.q('report-practice');button.disabled=true;this.q('report-message').textContent='Preparing your section…';try{await this.onPractice(this.record,this.report,this.selection);this.root.close();}catch(error){this.q('report-message').textContent=error.message;}finally{button.disabled=false;}};
    this.q('download-report').onclick=()=>{if(!this.report)return;const url=URL.createObjectURL(new Blob([this.record?.instrument==='vocals'?this.vocal.csv():reportCsv(this.report)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='groove-lab-note-report.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    window.addEventListener('resize',()=>{if(this.root.open)this.draw();});
  }
  open(record,report=null) {
    this.record=record;this.report=report;
    if(record.instrument==='vocals'){this.vocal.open(record,report);return;}
    this.vocal.panel.hidden=true;this.q('report-title').textContent='Your music, in focus.';this.q('report-replay').textContent='Play again';
    this.scale=1;this.start=0;this.limit=250;this.selection=null;
    this.q('report-subtitle').textContent=record.title+' · '+(record.partName||'Drums')+' · '+Math.round(record.bpm)+' BPM · '+(record.stopped?'Stopped · progress before stopping':'Completed attempt')+(report?' · '+formatDuration(report.elapsed)+' played':'');
    this.q('report-stats').innerHTML=[[(record.total?Math.round(record.accuracy)+'%':'—'),'match rate'],[record.hits+' / '+record.total,'notes matched'],[record.misses??record.total-record.hits-(record.wrong||0),'missed'],[record.wrong||0,'wrong notes'],[record.extras,'extra notes'],[record.meanAbsMs===null?'—':Math.round(record.meanAbsMs)+' ms','average timing error']].map(([number,label])=>'<div class="report-stat"><strong>'+number+'</strong><span>'+label+'</span></div>').join('');
    this.q('report-detail-help').textContent=report?(!report.notes.length?'No expected notes were reached. This preview does not add a saved attempt. ':report.stopped?'Future notes were not counted. ':'')+'Match rate counts attempted notes and extras. Timing uses matched notes only.':'This older attempt saved an overall summary only. New attempts include a detailed note report.';
    this.q('report-detail').hidden=!report;this.q('download-report').hidden=!report;this.q('report-message').textContent='';this.q('report-replay').disabled=!report;this.q('report-slower').hidden=record.sourceKind!=='builtin';this.q('report-slower').disabled=!report||record.bpm<=40;this.q('report-next').hidden=record.sourceKind!=='builtin';
    if(report){this.breakdown();const last=Math.max(...report.measures.map(m=>m[2]));for(const id of ['report-from','report-to']){this.q(id).max=last;this.q(id).value=report.measures[0][2];}this.selectBars(false);}
    if(!this.root.open)this.root.showModal();requestAnimationFrame(()=>this.render());
  }
  async replay(slower=false,next=false){if(this.record?.instrument==='vocals'){await this.vocal.retry(this.record.stopped&&this.report.elapsed<this.report.duration?this.report.elapsed:0);return;}try{const [startBar,endBar]=this.record.section.split('–').map(Number);await this.onPractice(this.record,this.report,{startBar,endBar},{replay:true,slower,next});this.root.close();}catch(error){this.q('report-message').textContent=error.message;}}
  clear(){this.root.close();this.record=null;this.report=null;this.vocal.report=null;this.vocal.record=null;this.vocal.panel.hidden=true;for(const id of ['report-subtitle','report-stats','report-notes','report-message'])this.q(id).textContent='';}
  selectBars(draw=true) {
    const from=Number(this.q('report-from').value),to=Number(this.q('report-to').value),last=Number(this.q('report-from').max);
    const valid=Number.isInteger(from)&&Number.isInteger(to)&&from>=1&&to>=from&&to<=last;
    this.selection=valid?{startBar:from,endBar:to}:null;this.q('report-practice').disabled=!valid;
    this.q('report-selection-label').textContent=valid?'Bars '+from+'–'+to+' · 4 practice passes':'Choose valid source bars.';if(draw)this.draw();
  }
  selectRange(from,to) {const range=reportSelection(this.report,from,to);if(range){this.q('report-from').value=range.startBar;this.q('report-to').value=range.endBar;this.selectBars();}}
  windowLength(){return Math.max(0.1,this.report.elapsed)/this.scale;}
  zoom(factor){if(!this.report)return;const selected=this.selection?this.report.measures.filter(m=>m[2]>=this.selection.startBar&&m[2]<=this.selection.endBar&&m[0]<=this.report.elapsed):[];const middle=selected.length?(selected[0][0]+Math.min(this.report.elapsed,selected.at(-1)[1]))/2:this.start+this.windowLength()/2;this.scale=Math.max(1,Math.min(32,this.scale*factor));this.start=Math.max(0,Math.min(this.report.elapsed-this.windowLength(),middle-this.windowLength()/2));this.limit=250;this.render();}
  timeAt(event){const rect=this.q('timing-chart').getBoundingClientRect();return this.start+Math.max(0,Math.min(1,(event.clientX-rect.left-40)/Math.max(1,rect.width-58)))*this.windowLength();}
  render(){if(!this.report)return;this.q('report-pan').max=Math.max(0,this.report.elapsed-this.windowLength());this.q('report-pan').value=this.start;this.q('report-pan-label').hidden=this.scale===1;this.q('report-zoom-label').textContent=this.scale+'× · '+formatDuration(this.start)+'–'+formatDuration(this.start+this.windowLength());this.draw();this.table();}
  breakdown(){
    const rows=(this.record.drums||[]).map(d=>'<tr><td>'+escapeHtml(DRUMS.find(item=>item.id===d.id)?.name||d.id)+'</td><td>'+d.hits+' / '+d.total+'</td><td>'+(d.meanAbsMs===null?'—':Math.round(d.meanAbsMs)+' ms')+'</td></tr>');
    const passes=new Map();for(const n of this.report.notes){if(!passes.has(n[8]))passes.set(n[8],[]);passes.get(n[8]).push(n);}
    if(passes.size>1)for(const [pass,notes] of passes){const hits=notes.filter(n=>n[4]==='hit');rows.push('<tr><td>Pass '+pass+'</td><td>'+hits.length+' / '+notes.length+'</td><td>'+(hits.length?Math.round(hits.reduce((sum,n)=>sum+Math.abs(n[5]),0)/hits.length)+' ms':'—')+'</td></tr>');}
    this.q('report-breakdown').hidden=!rows.length;this.q('report-breakdown-content').innerHTML='<div class="table-wrap"><table><thead><tr><th>Drum / pass</th><th>Matched</th><th>Average error</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
  }
  table(){
    if(!this.report)return;const extras=this.report.extras.map(([time,voice])=>{const m=reportMeasureAt(this.report,time);return [time,m[2],0,voice,'extra',null,null,m[2],m[3]];});const visible=[...this.report.notes,...extras].sort((a,b)=>a[0]-b[0]).filter(n=>n[0]>=this.start-1e-6&&n[0]<=this.start+this.windowLength()+1e-6);
    this.q('report-notes').innerHTML=visible.slice(0,this.limit).map(n=>'<tr><td><button class="text-button" data-report-bar="'+n[7]+'">'+n[7]+' / '+(n[4]==='extra'?'extra':Math.round(n[2]*100)/100)+(n[8]>1?' · pass '+n[8]:'')+'</button></td><td>'+escapeHtml(typeof n[3]==='number'?pitchName(n[3]):DRUMS.find(d=>d.id===n[3])?.name||n[3])+'</td><td>'+n[4]+(n[4]==='wrong'?' · played '+pitchName(n[6]):'')+'</td><td>'+(n[5]===null?'—':Math.round(Math.abs(n[5]))+' ms '+(n[5]<0?'early':'late'))+'</td></tr>').join('');this.q('report-more').hidden=visible.length<=this.limit;
  }
  draw(){
    if(this.record?.instrument==='vocals'){this.vocal.render();return;}
    if(!this.report||!this.root.open)return;const canvas=this.q('timing-chart'),rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(2,devicePixelRatio||1);if(!w||!h)return;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#102023';c.fillRect(0,0,w,h);
    const x=time=>40+(time-this.start)/this.windowLength()*(w-58),mid=(h-30)/2,y=error=>mid-error/this.report.tolerance*(mid-24);
    c.save();c.beginPath();c.rect(40,0,w-58,h);c.clip();
    for(const m of this.report.measures){if(m[1]<this.start||m[0]>this.start+this.windowLength())continue;if(this.selection&&m[2]>=this.selection.startBar&&m[2]<=this.selection.endBar){c.fillStyle='#e8c17b22';c.fillRect(x(m[0]),0,x(m[1])-x(m[0]),h-22);}c.strokeStyle='#385157';c.beginPath();c.moveTo(x(m[0]),20);c.lineTo(x(m[0]),h-25);c.stroke();c.fillStyle='#adc1c4';c.font='10px system-ui';c.fillText('Bar '+m[2],x(m[0])+3,14);}
    for(const n of this.report.notes){if(n[0]<this.start||n[0]>this.start+this.windowLength())continue;const px=x(n[0]);c.fillStyle=n[4]==='hit'?'#63d9c4':'#f58c99';if(n[4]==='miss'){c.font='bold 15px system-ui';c.fillText('×',px-4,h-32);}else{c.beginPath();c.arc(px,y(n[5]||0),4,0,Math.PI*2);c.fill();}}
    for(const [at] of this.report.extras){if(at<this.start||at>this.start+this.windowLength())continue;c.fillStyle='#e8c17b';c.fillRect(x(at)-3,mid-3,6,6);}
    c.restore();c.font='10px system-ui';for(const v of [-this.report.tolerance,0,this.report.tolerance]){c.strokeStyle='#496165';c.beginPath();c.moveTo(40,y(v));c.lineTo(w-18,y(v));c.stroke();c.fillStyle='#adc1c4';c.fillText((v>0?'+':'')+v,3,y(v)+3);}c.fillText(formatDuration(this.start),40,h-7);c.fillText(formatDuration(this.start+this.windowLength()),w-50,h-7);
  }
}
