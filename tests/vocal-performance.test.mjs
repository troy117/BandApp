import test from 'node:test';
import assert from 'node:assert/strict';
import { VocalPerformance,vocalWindows,vocalSummary,validateVocalReport } from '../dist/vocal-performance.mjs';
import { vocalPhraseSummary } from '../dist/vocal-report-view.mjs';
import { SingingPractice } from '../dist/singing-practice.mjs';

const chart={duration:8,notes:[{time:1,duration:2,pitch:60},{time:4,duration:2,pitch:64}],measures:[{time:0,endTime:4,bar:1},{time:4,endTime:8,bar:2}],lyrics:[{time:1,end:3,text:'First original phrase'},{time:4,end:6,text:'Second original phrase'}]};
const sample=midi=>({midi,confidence:.99,clipped:false});
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function sing(tracker,end,step,detect){for(let i=0;i<=Math.round(end/step);i++){const t=i*step;tracker.observe(t,detect(t));}return tracker.report(end);}

test('vocal accuracy weights sustained time independently of display frame rate and excludes rests and future notes',()=>{
 for(const step of [.02,.1]){
  const t=new VocalPerformance(chart),report=sing(t,8,step,time=>sample(time<4?60:64)),s=vocalSummary(report);
  near(s.measuredSeconds,3.84);near(s.accuracy,100);near(s.coverage,100);assert.equal(validateVocalReport(report,chart).instrument,'vocals');
 }
 const tracker=new VocalPerformance(chart),report=sing(tracker,2.2,.02,()=>sample(60));
 near(vocalSummary(report).measuredSeconds,1.12);assert.ok(report.frames.every(f=>f[1]<=2.2));assert.equal(report.phrases.length,1);
});

test('reports separate low/high singing, quiet and clipped input and honor the comfortable octave choice',()=>{
 const t=new VocalPerformance(chart),report=sing(t,8,.02,time=>time<2?sample(60):time<3?sample(59):time<5?null:{...sample(64),clipped:true}),s=vocalSummary(report);
 assert.ok(s.onSeconds>.9&&s.lowSeconds>.9&&s.quietSeconds>.9&&s.unclearSeconds>.9);assert.equal(s.highSeconds,0);assert.ok(s.accuracy>20&&s.accuracy<30);
 for(const anyOctave of [true,false]){const p=new VocalPerformance(chart,{anyOctave}),r=sing(p,3,.02,()=>sample(72));near(vocalSummary(r).accuracy,anyOctave?100:0);if(!anyOctave)near(vocalSummary(r).highSeconds,1.92);}
 assert.ok(vocalPhraseSummary(report,1,3).lowSeconds>.9);assert.equal(vocalPhraseSummary(report,4,6).heardSeconds,0);
});

test('microphone gaps, backward clock corrections and long stalls never invent or double count pitch',()=>{
 const p=new VocalPerformance(chart);p.observe(1.1,sample(60));p.observe(1.2,sample(60));p.disconnect();p.observe(2.5,sample(60));p.observe(2.6,sample(60));p.observe(1.5,sample(60));p.observe(2.6,sample(60));p.observe(2.7,sample(60));
 const s=vocalSummary(p.report(3));near(s.measuredSeconds,.3);near(s.accuracy,100);assert.ok(s.coverage<20);
 const from=new VocalPerformance(chart,{from:4.5});const r=sing(from,6,.02,()=>sample(64));assert.ok(r.frames.every(f=>f[0]>=4.5));assert.equal(r.phrases.length,1);
});

test('overlapping pitches and note transitions are not mistaken for off-pitch singing',()=>{
 const c={...chart,notes:[{time:1,duration:2,pitch:60},{time:2,duration:.5,pitch:64},{time:3,duration:.05,pitch:67}]};
 assert.deepEqual(vocalWindows(c),[{time:1.08,end:2,pitch:60},{time:2.5,end:3,pitch:60}]);
});

test('vocal report validation rejects future detail, a different backing clock and invalid pitch totals',()=>{
 const r=sing(new VocalPerformance(chart),2.2,.02,()=>sample(60));
 assert.throws(()=>validateVocalReport({...r,elapsed:1.5},chart));
 assert.throws(()=>validateVocalReport(r,{...chart,duration:9}));
 const frames=structuredClone(r.frames);frames[0][3]=10;assert.throws(()=>validateVocalReport({...r,frames},chart));
 const targets=structuredClone(r.targets);targets[0][2]++;assert.throws(()=>validateVocalReport({...r,targets},chart));
});

test('stopping creates a replayable vocal report only for the account that sang with the microphone',t=>{
 const previous=globalThis.document;globalThis.document={hidden:false};t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 const calls=[],fields={},p={school:{},collapse(){},onAttempt:r=>calls.push(r),onReport:(r,detail)=>calls.push(detail)};
 const singing=Object.assign(Object.create(SingingPractice.prototype),{practice:p,q:id=>fields[id]||={}});
 const performance=new VocalPerformance(chart);sing(performance,2.2,.02,()=>sample(60));
 const session={vocalPerformance:performance,accountId:null,part:{id:'vocals',name:'Vocals',instrument:'vocals',chart},judge:{chart},arrangement:{title:'Original practice',id:'local',revisionId:'v1',sourceKind:'personal'}};
 const report=singing.finishAttempt(session,2.2);assert.equal(report.stopped,true);assert.equal(calls.length,2);assert.equal(singing.lastVocal.report,report);
 p.school.user={id:'different-account'};singing.finishAttempt(session,2.2);assert.equal(calls.length,2);
 session.vocalPerformance=new VocalPerformance(chart);assert.equal(singing.finishAttempt(session,2.2),undefined);
});
