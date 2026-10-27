export function canListenInBackground(session) {
  return !!session&&!session.takeId&&!session.teacher&&(session.listen||['guitar','bass'].includes(session.part?.instrument));
}
export function listeningTime(value,duration) {return Math.max(0,Math.min(Math.max(0,duration-.05),Number(value)||0));}
export function listeningClock(value) {const seconds=Math.max(0,Math.floor(value||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}

export class InstrumentListening {
  constructor(practice) {
    this.practice=practice;this.q=practice.q;this.position=0;
    this.q('b-seek').oninput=()=>{this.scrubbing=true;this.label(Number(this.q('b-seek').value));};
    this.q('b-seek').onchange=()=>{this.scrubbing=false;practice.attempt(()=>this.seek(Number(this.q('b-seek').value)));};
    this.q('b-seek').onblur=this.q('b-seek').onpointercancel=()=>{this.scrubbing=false;this.update();};
    this.q('b-jump').onclick=()=>practice.attempt(async()=>{
      const chart=practice.playChart(),bar=Number(this.q('b-start-bar').value);
      if(!Number.isInteger(bar)||bar<1||bar>(chart.sourceBars||practice.part.chart.bars))throw new Error('Choose a bar in this song.');
      const measure=chart.measures?.find(m=>(m.sourceBar||m.bar)===bar);
      if(!measure)throw new Error('Choose a bar inside the selected loop.');
      await this.seek(measure.time);
    });
    this.q('b-pause-listening').onclick=()=>practice.attempt(async()=>{
      if(practice.session)this.pause();else await practice.play(true);
    });
  }
  reset() {this.position=0;this.scrubbing=false;this.update();}
  pause() {
    const p=this.practice;if(!canListenInBackground(p.session))return;
    const at=this.current();p.stop('Listening paused. Continue or choose another position.',false);this.position=at;this.update();
  }
  current() {const p=this.practice;return p.session?listeningTime(p.audio.audibleTime()-p.session.startAt,p.session.judge.chart.duration):this.position;}
  async seek(value) {
    const p=this.practice;if(p.rooms.room||p.session&&!canListenInBackground(p.session))return;
    const resume=!!p.session,listen=p.session?.listen??true,at=listeningTime(value,p.playChart().duration);
    p.stop('',false);this.position=at;this.update();if(resume)await p.play(listen);
  }
  label(at) {const chart=this.practice.playChart();this.q('b-seek-time').textContent=listeningClock(at)+' / '+listeningClock(chart.duration);}
  update() {
    const p=this.practice,visible=p.part.instrument!=='vocals'&&!p.rooms.room,enabled=!p.session||canListenInBackground(p.session),chart=p.playChart();
    this.q('b-seek-controls').hidden=!visible;
    const controls=p.highwayExperience?.controls;
    if(controls){const home=visible?this.q('b-seek-controls'):this.q('b-stage');if(controls.parentElement!==home){if(visible)home.append(controls);else this.q('b-canvas').before(controls);}}
    this.q('b-seek').max=Math.max(0,chart.duration-.05);if(!this.scrubbing){this.q('b-seek').value=this.current();this.label(this.current());}
    for(const id of ['b-seek','b-start-bar','b-jump','b-pause-listening'])this.q(id).disabled=!enabled;
    this.q('b-start-bar').max=p.part.chart.bars;this.q('b-pause-listening').textContent=p.session?'Ⅱ Pause':'▶ Listen here';
  }
}
