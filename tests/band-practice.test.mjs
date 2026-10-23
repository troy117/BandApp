import test from 'node:test';
import assert from 'node:assert/strict';
import { BandPractice } from '../dist/band-practice.mjs';
import { PitchJudge, SessionClock, DEFAULT_PIANO_BINDINGS } from '../dist/instruments.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';
import { PianoVoices } from '../dist/piano-audio.mjs';

function bandDocument(t, document) {
  const previous=globalThis.document;globalThis.document=document;
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
}
test('shared playback maps the scheduled server clock once and rejects an unready or late start',t=>{
  bandDocument(t,{hidden:false});const clock=new SessionClock(),now=performance.now();
  for(let i=0;i<3;i++)clock.add(now+i*10,now+i*10+2,now+i*10+1001);
  const began=[],unready=[];
  const practice=Object.assign(Object.create(BandPractice.prototype),{rooms:{prepared:true,unready:reason=>unready.push(reason)},arrangement:{revisionId:'v1'},audio:{context:{state:'running'},audibleTime:stamp=>stamp/1000},stop:()=>{},begin:(start,options)=>began.push({start,options}),message:()=>{}});
  const room={takeId:'take-a',arrangement:{revisionId:'v1'},startAt:clock.serverAt(now+5000),countInAt:clock.serverAt(now+2000)};
  practice.startScheduled(room,clock,false);practice.startScheduled(room,clock,false);
  assert.equal(began.length,1);assert.ok(Math.abs(began[0].start-(now+5000)/1000)<0.00001);assert.equal(began[0].options.takeId,'take-a');
  practice.startScheduled({...room,takeId:'late',countInAt:clock.serverAt(performance.now()-100)},clock,false);assert.equal(unready.length,1);assert.equal(began.length,1);
  practice.startScheduled({...room,takeId:'wrong-song',arrangement:{revisionId:'v1',id:'another-song'}},clock,false);
  practice.startScheduled({...room,takeId:'wrong-bar',arrangement:{revisionId:'v1',startBar:3}},clock,false);
  assert.equal(unready.length,3);assert.equal(began.length,1);
});
test('keyboard timing uses the native event timestamp and local correction rather than the processing time',t=>{
  bandDocument(t,{querySelector:()=>null});const chart=builtinArrangement().parts[1].chart,now=performance.now(),judge=new PitchJudge(chart),fields={};
  const practice=Object.assign(Object.create(BandPractice.prototype),{mode:'keyboard',part:{instrument:'keyboard'},rooms:{teacher:false},held:new Map(),piano:{off:()=>{}},token:1,offset:20,highlight:()=>{},stats:()=>{},audio:{audibleTime:stamp=>stamp/1000},q:id=>fields[id]||(fields[id]={checked:false,textContent:''}),session:{judge,startAt:now/1000}});
  practice.input(60,now-80,'midi',0.7,'midi-note');
  assert.equal(judge.summary().hits,1);assert.ok(Math.abs(judge.chart.notes[0].errorMs+100)<0.001);assert.equal(judge.chart.notes[0].source,'midi');
});
test('computer-key piano input protects typing, suppresses repeat keydowns and forwards the original timestamp',t=>{
  bandDocument(t,{querySelector:()=>null});const played=[],released=[];
  const practice=Object.assign(Object.create(BandPractice.prototype),{mode:'keyboard',part:{instrument:'keyboard'},bindings:DEFAULT_PIANO_BINDINGS,octave:0,capture:null,held:new Map(),input:(pitch,stamp,source,velocity,id)=>{played.push({pitch,stamp,source});practice.held.set(id,pitch);},release:id=>{released.push(id);practice.held.delete(id);}});
  const event={code:'KeyA',timeStamp:123,target:{closest:()=>null},preventDefault:()=>{}};
  practice.keyDown(event);practice.keyDown(event);practice.keyDown({...event,repeat:true});practice.keyDown({...event,code:'KeyD',target:{closest:()=>({tagName:'INPUT'})}});
  assert.deepEqual(played,[{pitch:60,stamp:123,source:'keyboard'}]);practice.keyUp(event);assert.deepEqual(released,['KeyA']);
});
test('scheduled piano guide voices remain cancellable through release and Stop',()=>{
  const voices=[],parameter=()=>({setValueAtTime:()=>{},linearRampToValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{},setTargetAtTime:()=>{},cancelScheduledValues:()=>{}});
  const audio={sources:new Set(),master:{},context:{state:'running',currentTime:10,createOscillator:()=>{const voice={frequency:{},connect:node=>node,disconnect:node=>node,start:at=>{voice.started=at;},stop:at=>{voice.stopped=at;}};voices.push(voice);return voice;},createGain:()=>({gain:parameter(),connect:node=>node,disconnect:node=>node})}};
  const piano=new PianoVoices(audio);piano.on('guide',60,0.7,11);piano.off('guide',11.5);
  assert.equal(audio.sources.size,1);assert.equal(piano.active.size,1);piano.clear();assert.equal(voices[0].stopped,undefined);
  voices[0].onended();assert.equal(piano.active.size,0);assert.equal(audio.sources.size,0);
});
