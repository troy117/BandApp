import test from 'node:test';
import assert from 'node:assert/strict';
import { BeatRecorder, beatPlan, validateBeatTake, BEAT_LIMITS } from '../dist/beat-recorder.mjs';

class BeatTestAudio {
  constructor() { this.context = new EventTarget(); Object.assign(this.context,{state:'running',currentTime:10});this.backings=[];this.notes=[];this.clicks=[];this.silences=0; }
  async ready() {}
  audibleTime(timestamp) { return timestamp === undefined ? this.context.currentTime : timestamp/1000; }
  silence(){this.silences++;}
  playBacking(buffer,when,offset,volume,duration){this.backings.push({when,offset,volume,duration});}
  play(drum,time,velocity){this.notes.push({drum,time,velocity});}
  click(time,downbeat){this.clicks.push({time,downbeat});}
}
function fixture(t, duration=2) {
  const audio=new BeatTestAudio(),messages=[],recorder=new BeatRecorder(audio,m=>messages.push(m));
  recorder.setSource({name:'synthetic.wav',buffer:{duration},bytes:new ArrayBuffer(10)});
  t.after(()=>recorder.stop());return {audio,recorder,messages};
}
function at(audio,run,seconds){audio.context.currentTime=run.startAt+seconds;return audio.context.currentTime*1000;}

test('record loops use exact audio boundaries, one count-in and timestamped unquantized hits',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:3,bpm:120,countIn:true});const run=recorder.run;
  assert.equal(audio.clicks.length,4);assert.deepEqual(audio.backings.map(b=>b.when),[run.startAt,run.startAt+2,run.startAt+4]);assert.ok(audio.backings.every(b=>b.duration===2&&b.offset===0));
  assert.equal(recorder.hit('kick',at(audio,run,-.01),1,false),false);
  for(const [time,drum,velocity] of [[.213,'kick',.4],[1.99,'hihat',.5],[2.001,'hihat-open',.8],[4.7,'hihat-pedal',.3]])assert.equal(recorder.hit(drum,at(audio,run,time),velocity,false),true);
  at(audio,run,6.01);recorder.tick();assert.equal(recorder.run,null);assert.equal(recorder.take.hits.length,4);assert.equal(recorder.take.duration,6);
  assert.ok(Math.abs(recorder.take.hits[0].time-.213)<1e-10);assert.deepEqual(recorder.take.hits.map(h=>h.drum),['kick','hihat','hihat-open','hihat-pedal']);assert.equal(recorder.take.hits[2].velocity,.8);
  validateBeatTake(recorder.take,2);
});

test('stopped takes replay only their recorded duration; live input during replay does not overdub',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:4,countIn:false});let run=recorder.run;
  recorder.hit('snare',at(audio,run,.25),.7,false);recorder.hit('kick',at(audio,run,2.25),1,false);at(audio,run,2.8);recorder.stop('Stopped');
  const take=structuredClone(recorder.take);audio.backings=[];await recorder.start('replay',{countIn:false});run=recorder.run;
  assert.equal(audio.backings.length,2);assert.ok(Math.abs(audio.backings[1].duration-.8)<1e-10);
  at(audio,run,.2);recorder.tick();recorder.tick();assert.equal(audio.notes.length,1);assert.ok(Math.abs(audio.notes[0].time-(run.startAt+.25))<1e-10);
  recorder.hit('snare',at(audio,run,.3),1,false);assert.deepEqual(recorder.take,take);
  at(audio,run,2.2);recorder.tick();assert.equal(audio.notes.length,2);at(audio,run,2.81);recorder.tick();assert.equal(recorder.busy,false);assert.deepEqual(recorder.take,take);
});

test('delay correction uses the existing sign, keeps velocities and sorts out-of-order timestamps',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:1,countIn:false,offset:.05});const run=recorder.run;
  recorder.hit('kick',at(audio,run,.52),.333,false);recorder.hit('snare',(run.startAt+.25)*1000,.7,false);
  assert.equal(recorder.hit('kick',at(audio,run,.02),1,false),false);at(audio,run,1);recorder.stop();
  assert.deepEqual(recorder.take.hits.map(h=>h.drum),['snare','kick']);assert.ok(Math.abs(recorder.take.hits[0].time-.2)<1e-10);assert.equal(recorder.take.hits[1].velocity,.333);
});

test('repeated starts and stops cannot create duplicate takes or schedules',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:1,countIn:false});const run=recorder.run;
  assert.equal(await recorder.start('record'),false);assert.equal(audio.backings.length,1);
  recorder.hit('kick',at(audio,run,.1),1,false);at(audio,run,.4);recorder.stop();const take=recorder.take;recorder.stop();recorder.tick();assert.equal(recorder.take,take);
  await recorder.start('record',{repeats:1,countIn:false});recorder.stop('Cancelled');assert.equal(recorder.take,take);
});

test('cancelling pending audio activation prevents a late recording or playback',async t=>{
  const {audio,recorder}=fixture(t);let resolve;audio.ready=()=>new Promise(r=>resolve=r);
  const started=recorder.start('record',{repeats:1});assert.equal(recorder.starting,true);recorder.stop();resolve();assert.equal(await started,false);assert.equal(audio.backings.length,0);assert.equal(recorder.busy,false);
});

test('audio permission/activation failure resets controls and can be retried',async t=>{
  const {audio,recorder}=fixture(t);audio.ready=async()=>{throw new Error('Audio blocked');};await assert.rejects(recorder.start('record'),/Audio blocked/);assert.equal(recorder.busy,false);assert.equal(recorder.run,null);audio.ready=async()=>{};assert.equal(await recorder.start('record'),true);
});

test('audio suspension keeps a partial take and releases the state listener',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{countIn:false});const run=recorder.run;
  recorder.hit('kick',at(audio,run,.2),1,false);at(audio,run,.6);recorder.tick();audio.context.state='suspended';audio.context.dispatchEvent(new Event('statechange'));
  assert.equal(recorder.busy,false);assert.ok(Math.abs(recorder.take.duration-.6)<1e-10);const take=recorder.take;audio.context.dispatchEvent(new Event('statechange'));assert.equal(recorder.take,take);assert.equal(recorder.timer,null);
});

test('invalid strikes, silent releases and out-of-range hits are ignored',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:1,countIn:false});const run=recorder.run;const stamp=at(audio,run,.3);
  for(const args of [['kick',stamp,0],['unknown',stamp,1],['kick',NaN,1],['kick',stamp,NaN],['kick',(run.startAt+2)*1000,1]])assert.equal(recorder.hit(...args),false);
  assert.equal(run.hits.length,0);
});

test('a hit immediately before suspension survives a stale scheduler clock',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:1,countIn:false});const run=recorder.run;
  recorder.hit('kick',at(audio,run,.2),1,false);audio.context.state='suspended';audio.context.dispatchEvent(new Event('statechange'));
  assert.equal(recorder.take.hits.length,1);assert.ok(recorder.take.duration>recorder.take.hits[0].time);validateBeatTake(recorder.take,2);
});

test('late replay scheduler skips obsolete notes and a muted beat stays silent',async t=>{
  const {audio,recorder}=fixture(t);await recorder.start('record',{repeats:1,countIn:false});let run=recorder.run;
  for(const time of [.1,.3,.5])recorder.hit('snare',at(audio,run,time),1,false);at(audio,run,1);recorder.stop();
  await recorder.start('replay',{countIn:false});run=recorder.run;at(audio,run,.25);recorder.tick();assert.equal(audio.notes.length,1);recorder.beatVolume=0;at(audio,run,.45);recorder.tick();assert.equal(audio.notes.length,1);
});

test('limits and saved take validation reject corrupt/oversized input while preserving the current source',async t=>{
  const {recorder}=fixture(t);const source=recorder.source;
  for(const [duration,options] of [[0,{}],[601,{}],[300,{repeats:5}],[2,{repeats:1.5}],[2,{bpm:0}],[2,{offset:1}]])assert.throws(()=>beatPlan(duration,options));
  assert.throws(()=>recorder.setSource({name:'large',bytes:new ArrayBuffer(BEAT_LIMITS.bytes+1),buffer:{duration:2}}));assert.equal(recorder.source,source);
  const take={version:1,id:'synthetic',loopSeconds:2,repeats:1,bpm:80,countIn:false,offset:0,duration:1,hits:[{drum:'kick',time:.1,velocity:1}]};
  validateBeatTake(take,2);for(const change of [{version:0},{duration:10},{hits:[{drum:'kick',time:1,velocity:1}]},{loopSeconds:3}])assert.throws(()=>validateBeatTake({...take,...change},2));
});
