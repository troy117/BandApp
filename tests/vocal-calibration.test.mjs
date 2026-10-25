import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrationSignal,calibrationTemplate,findCalibrationSignal,calibrationMeasurement,VocalCalibration} from '../dist/vocal-calibration.mjs';

test('chirp matching finds capture time through sample-rate changes, phase, noise and a weaker echo',()=>{
  for(const rate of [16000,44100,48000])for(const variant of [0,1]){
    const signal=new Float32Array(2**Math.ceil(Math.log2(rate*.22))),start=Math.round(rate*.123),sine=calibrationSignal(rate,variant),cosine=calibrationSignal(rate,variant,true);let seed=7;
    for(let i=0;i<signal.length;i++){seed=seed*16807%2147483647;signal[i]=(seed/2147483647-.5)*.012;}
    for(let i=0;i<sine.length;i++){const value=.11*(sine[i]*.5+cosine[i]*.86);signal[start+i]+=value;const echo=start+i+Math.round(rate*.023);if(echo<signal.length)signal[echo]+=value*.25;}
    const result=findCalibrationSignal(signal,rate,calibrationTemplate(rate,variant));
    assert.ok(result,`${rate} Hz variant ${variant}`);assert.ok(Math.abs(result.offset-start/rate)<.002);assert.ok(result.score>.55);
    assert.equal(findCalibrationSignal(signal,rate,calibrationTemplate(rate,1-variant)),null);
  }
});

test('silence, music-like harmonics, noise and ambiguous repeated probes cannot save a timing guess',()=>{
  const rate=48000,length=16384,wave=new Float32Array(length),probe=calibrationSignal(rate);let seed=9;
  assert.equal(findCalibrationSignal(wave,rate),null);
  for(let i=0;i<length;i++){seed=seed*16807%2147483647;wave[i]=.1*Math.sin(2*Math.PI*220*i/rate)+.1*Math.sin(2*Math.PI*440*i/rate)+(seed/2147483647-.5)*.07;}
  assert.equal(findCalibrationSignal(wave,rate),null);
  wave.fill(0);wave.set(probe,1000);wave.set(probe,6000);assert.equal(findCalibrationSignal(wave,rate),null);
  assert.equal(calibrationMeasurement([{delay:.2,score:.9},{delay:.2,score:.9},{delay:.2,score:.9}]),null);
  assert.equal(calibrationMeasurement([.1,.2,.3,.4,.5].map(delay=>({delay,score:.9}))),null);
  assert.equal(calibrationMeasurement([.2,.2,.2,.2,.2].map(delay=>({delay,score:.2}))),null);
  assert.deepEqual(calibrationMeasurement([.18,.183,.179,.181,.7].map(delay=>({delay,score:.9}))),{milliseconds:181,matches:4,spreadMs:4});
});

function calibrationFixture({heard=true,outputKnown=true}={}){
  let now=0;const nodes=new Map(),sources=[],storage=new Map(),events={};
  const q=id=>{if(!nodes.has(id))nodes.set(id,{value:0,textContent:'',hidden:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
  const environment={performance:{now:()=>now*1000},Date:{now:()=>1700000000000+now*1000},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},navigator:{mediaDevices:{addEventListener:(name,fn)=>events[name]=fn,enumerateDevices:async()=>outputKnown?[{kind:'audiooutput',deviceId:'default',label:'Default - Test headphones'}]:[]}}};
  const analyser={disconnect(){this.disconnected=true;},getFloatTimeDomainData(buffer){buffer.fill(0);if(!heard)return;for(const source of sources){if(source.stopped)continue;const data=source.buffer.getChannelData(0);for(let i=0;i<buffer.length;i++){const at=now-buffer.length/48000+i/48000-source.at-.12-.18,index=Math.round(at*48000);if(index>=0&&index<data.length)buffer[i]+=data[index]*.12;}}}};
  const mic={state:'listening',inputLatency:.08,context:{sampleRate:48000,state:'running',createAnalyser:()=>analyser},source:{connect(){},disconnect(){}},stream:{getAudioTracks:()=>[{getSettings:()=>({deviceId:'mic-1',sampleRate:48000,echoCancellation:true})}]},setCalibration(value){this.calibratedLatency=value;},async start(){},stop(){this.state='off';this.calibratedLatency=null;}};
  const context={get currentTime(){return now;},state:'running',sampleRate:48000,outputLatency:.12,createBuffer(_channels,length){const data=new Float32Array(length);return{getChannelData:()=>data};},createGain:()=>({gain:{},connect(){},disconnect(){}}),createBufferSource(){const source={connect(){},disconnect(){},addEventListener(){},start(at){this.at=at;},stop(){this.stopped=true;}};sources.push(source);return source;}};
  const singing={q,practice:{rooms:{},part:{instrument:'vocals'},audio:{context,output:{},ready:async()=>{},audibleTime:stamp=>stamp/1000-.12},attempt:fn=>fn()},microphone:mic,warmup:{stop(){}},renderLatency(){}};
  const calibration=new VocalCalibration(singing,environment);q('b-vocal-delay').oninput=()=>{};
  return {calibration,mic,singing,q,storage,sources,environment,events,advance:seconds=>{now+=seconds;},run(){for(let i=0;i<450;i++){now+=.016;calibration.draw();}}};
}

test('automatic loopback check separates already-compensated output delay and applies/saves measured input timing',async()=>{
  const f=calibrationFixture();await f.calibration.start();assert.equal(f.calibration.busy,true);assert.equal(f.sources.length,5);
  f.run();assert.equal(f.calibration.busy,false);assert.ok(Math.abs(f.mic.calibratedLatency-.18)<.002);assert.equal(f.calibration.profile.matches,5);assert.equal(f.q('b-vocal-delay').value,'0');
  assert.match(f.q('b-calibration-state').textContent,/Timing set automatically/);assert.equal(f.storage.size,1);
  const restored=calibrationFixture();for(const [key,value]of f.storage)restored.storage.set(key,value);restored.advance(8);await restored.calibration.microphoneChanged('listening');assert.ok(Math.abs(restored.mic.calibratedLatency-.18)<.002);
  restored.singing.practice.audio.context.outputLatency=.3;await restored.calibration.microphoneChanged('listening');assert.equal(restored.mic.calibratedLatency,null);
  f.mic.state='off';await f.calibration.microphoneChanged('off');f.mic.state='listening';await f.calibration.microphoneChanged('listening');assert.ok(Math.abs(f.mic.calibratedLatency-.18)<.002);
  f.events.devicechange();assert.equal(f.mic.calibratedLatency,null);assert.equal(f.calibration.profile,null);assert.match(f.q('b-calibration-state').textContent,/changed/);
});

test('unheard test sounds preserve previous timing and cancelling stops every scheduled source',async()=>{
  const f=calibrationFixture({heard:false});f.mic.calibratedLatency=.16;await f.calibration.start();f.run();assert.equal(f.mic.calibratedLatency,.16);assert.equal(f.storage.size,0);assert.match(f.q('b-calibration-state').textContent,/No reliable/);
  await f.calibration.start();f.calibration.stop('Cancelled');assert(f.sources.every(s=>s.stopped));assert.equal(f.calibration.busy,false);
  f.singing.practice.rooms.room={id:'a-room'};const count=f.sources.length;await f.calibration.start();assert.equal(f.sources.length,count);
});

test('unknown headphone output is reusable for this visit without pretending a persisted profile identifies it',async()=>{
  const f=calibrationFixture({outputKnown:false});await f.calibration.start();f.run();assert.equal(f.storage.size,0);assert.ok(f.calibration.profile);assert.match(f.q('b-calibration-state').textContent,/this visit/);
  f.mic.state='off';await f.calibration.microphoneChanged('off');f.mic.state='listening';await f.calibration.microphoneChanged('listening');assert.ok(f.calibration.profile);
});

test('permission-pending cancellation prevents late test tones and does not cancel its own permission request',async()=>{
  const f=calibrationFixture();let release;
  f.mic.start=async()=>{const permission=new Promise(resolve=>release=resolve);f.mic.state='requesting';await f.calibration.microphoneChanged('requesting');await permission;};
  const pending=f.calibration.start();assert.equal(f.calibration.busy,true);f.calibration.stop();assert.equal(f.mic.state,'off');release();await pending;assert.equal(f.sources.length,0);
});
test('denied microphone permission explains recovery in the open check and schedules no tones',async()=>{
  const f=calibrationFixture();f.mic.start=async()=>{f.mic.state='denied';await f.calibration.microphoneChanged('denied');};
  await f.calibration.start();assert.equal(f.calibration.busy,false);assert.equal(f.sources.length,0);assert.match(f.q('b-calibration-state').textContent,/Allow microphone access/);
});
