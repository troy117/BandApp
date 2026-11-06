import test from 'node:test';
import assert from 'node:assert/strict';
import { BandPractice } from '../dist/band-practice.mjs';
import { PitchJudge, SessionClock, DEFAULT_PIANO_BINDINGS } from '../dist/instruments.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';
import { PianoVoices } from '../dist/piano-audio.mjs';
import { Judge } from '../dist/engine.mjs';
import { isSessionAudioDevice, defaultSessionAudioUserId } from '../dist/session-audio.mjs';

function bandDocument(t, document) {
  const previous=globalThis.document;globalThis.document=document;
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
}
test('instrument pages load their selected instrument and reject songs without that part',async()=>{
 const loaded=[],p=Object.assign(Object.create(BandPractice.prototype),{mode:'keyboard',loadToken:0,rooms:{},catalog:[],stop(){},useArrangement:(song,instrument)=>loaded.push(instrument),message(){}});
 await p.loadChoice('duet:band-first');assert.deepEqual(loaded,['keyboard']);
 p.mode='guitar';await assert.rejects(()=>p.loadChoice('duet:duet-first'),/no guitar part/);assert.equal(loaded.length,1);
});
test('teacher sync workspace cannot be opened from a student or guest practice session',()=>{
 for(const user of [null,{role:'student'}]){const p=Object.assign(Object.create(BandPractice.prototype),{mode:'keyboard',school:{user,staff:false}});p.setMode('sync');assert.equal(p.mode,'keyboard');}
});

test('a delayed school catalog refresh keeps the song chosen while it was loading', async () => {
  let resolve; const select = { value: 'duet:duet-first' };
  const practice = Object.assign(Object.create(BandPractice.prototype), { arrangement: builtinArrangement(), school: { user: { id: 'student' }, request: () => new Promise(done => { resolve = done; }) }, q: () => select, rooms: { catalogChoices() {} }, renderCatalog() { select.value = 'duet:duet-first'; } });
  const pending = practice.refreshCatalog(); practice.arrangement = builtinArrangement('band-first'); select.value = 'duet:band-first';
  resolve({ songs: [{ sourceKind: 'duet', id: 'duet-first' }, { sourceKind: 'duet', id: 'band-first' }] }); await pending;
  assert.equal(select.value, 'duet:band-first');
});
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

test('classroom audio defaults to the drummer, falls back to teacher, and is exclusive',()=>{
 const people=[{userId:'singer',instrument:'vocals'},{userId:'drummer',instrument:'drums'}];
 assert.equal(defaultSessionAudioUserId(people,'teacher'),'drummer');assert.equal(defaultSessionAudioUserId(people.slice(0,1),'teacher'),'teacher');
 const room={teacherId:'teacher',audioUserId:'drummer'};
 assert.equal(isSessionAudioDevice(room,'drummer'),true);assert.equal(isSessionAudioDevice(room,'teacher'),false);assert.equal(isSessionAudioDevice(room,'singer'),false);assert.equal(isSessionAudioDevice(null,null),true);
});

test('only the selected jam device downloads backing; silent devices still activate their clock',async()=>{
 for(const userId of ['teacher','drummer','singer']){
  const calls=[],room={teacherId:'teacher',audioUserId:'drummer'},audio={context:{state:'running'},ready:async()=>calls.push('clock'),decodeBacking:async()=>({duration:20})};
  const p=Object.assign(Object.create(BandPractice.prototype),{school:{generation:1,user:{id:userId},download:async()=>{calls.push('download');return new ArrayBuffer(0);}},rooms:{room},audio,observedContext:audio.context,loadToken:1,arrangement:{audio:{route:'/backing',offset:0}},q:()=>({value:65})});
  await p.prepareAudio();assert.deepEqual(calls,userId==='drummer'?['clock','download']:['clock']);
 }
});
test('silent jam keyboard input still scores locally without playing an app tone',t=>{
 bandDocument(t,{querySelector:()=>null});const chart=builtinArrangement().parts[1].chart,now=performance.now(),judge=new PitchJudge(chart),sounds=[];
 const p=Object.assign(Object.create(BandPractice.prototype),{mode:'jam',school:{user:{id:'keys'}},part:{instrument:'keyboard'},rooms:{room:{teacherId:'teacher',audioUserId:'drummer'}},held:new Map(),piano:{on:()=>sounds.push('note'),off(){}},token:1,offset:0,highlight(){},stats(){},audio:{context:{state:'running'},audibleTime:stamp=>stamp/1000},q:()=>({checked:true}),session:{judge,startAt:now/1000}});
 p.input(60,now,'midi',.7,'midi-note');assert.equal(judge.summary().hits,1);assert.deepEqual(sounds,[]);
});

test('shared backing, count-in, metronome and synthesized guides play only on the chosen device',t=>{
 bandDocument(t,{hidden:false});
 for(const userId of ['teacher','drummer','singer'])for(const withBacking of [true,false]){
  const room={teacherId:'teacher',audioUserId:'drummer'},arrangement=builtinArrangement(),part=arrangement.parts[0],calls=[],fields={};
  const p=Object.assign(Object.create(BandPractice.prototype),{school:{user:{id:userId}},rooms:{room,progress(){}},arrangement,part,audio:{context:{currentTime:0},audibleTime:()=>0,playBacking:()=>calls.push('backing'),click:()=>calls.push('click'),play:()=>calls.push('drum')},piano:{on:()=>calls.push('note'),off(){}},q:id=>fields[id]||={checked:true,scrollIntoView(){}},playChart:()=>part.chart,lockControls(){},stats(){},expanded:true,offset:0,backing:withBacking?{buffer:{duration:100},offset:0,volume:.5}:null});
  p.begin(part.chart.countInBeats*part.chart.countInBeatSeconds,{takeId:'take',teacher:userId==='teacher',audioOutput:p.playsClassAudio});
  p.tick();p.audio.context.currentTime=p.session.startAt;p.tick();
  if(userId==='drummer'){assert.ok(calls.includes('click'));assert.ok(calls.includes(withBacking?'backing':'drum'));}else assert.deepEqual(calls,[]);
 }
});

test('keyboard and jam-drum reports remain available when automatic display is disabled',t=>{
 bandDocument(t,{hidden:false});
 for(const instrument of ['keyboard','drums']){
  const arrangement=builtinArrangement(),part=arrangement.parts.find(p=>p.instrument===instrument),judge=instrument==='keyboard'?new PitchJudge(part.chart):new Judge(part.chart),calls=[],fields={'b-auto-report':{checked:false}};
  judge.advance(Infinity);
  const p=Object.assign(Object.create(BandPractice.prototype),{school:{},part,offset:0,q:id=>fields[id]||={},collapse:()=>calls.push('collapse'),onReport:()=>calls.push('popup'),onAttempt:()=>calls.push('remember'),stats(){},report(){}});
  p.captureAttempt({judge,part,arrangement,accountId:null},false,part.chart.duration);
  assert.deepEqual(calls,['remember']);assert.ok(p.lastReport.detail.notes.length>0);
 }
});
