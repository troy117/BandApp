const CALIBRATION_SECONDS = .06;
const CALIBRATION_STORAGE = 'groove-vocal-calibration-v1';
const calibrationMedian = values => { const sorted = [...values].sort((a,b)=>a-b); return sorted[Math.floor(sorted.length/2)]; };

// A tapered chirp distinguishes the test sound from voices, steady tones and
// background noise. Quadrature matching tolerates the speaker's phase response.
export function calibrationSignal(rate, variant = 0, quadrature = false) {
  const length = Math.round(rate * CALIBRATION_SECONDS), signal = new Float32Array(length);
  const first = variant % 2 ? 2400 : 1200, last = variant % 2 ? 1200 : 2400;
  for (let i=0;i<length;i++) {
    const t=i/rate, envelope=Math.sin(Math.PI*i/(length-1))**2;
    const phase=2*Math.PI*(first*t+(last-first)*t*t/(2*CALIBRATION_SECONDS));
    signal[i]=envelope*(quadrature?Math.cos(phase):Math.sin(phase));
  }
  return signal;
}

export function calibrationTemplate(sampleRate, variant = 0) {
  const stride=Math.max(1,Math.floor(sampleRate/8000)),rate=sampleRate/stride;
  const sine=calibrationSignal(rate,variant),cosine=calibrationSignal(rate,variant,true);
  return {stride,rate,sine,cosine,energy:sine.reduce((sum,x)=>sum+x*x,0)};
}

export function findCalibrationSignal(input, sampleRate, template = calibrationTemplate(sampleRate)) {
  const {stride,rate,sine,cosine,energy}=template,signal=new Float32Array(Math.floor(input.length/stride));
  for(let i=0;i<signal.length;i++){let sum=0;for(let j=0;j<stride;j++)sum+=input[i*stride+j];signal[i]=sum/stride;}
  const prefix=new Float64Array(signal.length+1);
  for(let i=0;i<signal.length;i++)prefix[i+1]=prefix[i]+signal[i]*signal[i];
  const end=signal.length-sine.length;if(end<0)return null;
  const score=at=>{
    const power=prefix[at+sine.length]-prefix[at];
    if(power/sine.length<.000004)return 0;
    let a=0,b=0;for(let i=0;i<sine.length;i++){a+=signal[at+i]*sine[i];b+=signal[at+i]*cosine[i];}
    return Math.min(1,(a*a+b*b)/(power*energy));
  };
  const step=Math.max(1,Math.round(rate*.0005));let best=0,position=0;
  for(let at=0;at<=end;at+=step){const value=score(at);if(value>best){best=value;position=at;}}
  const coarse=position;
  for(let at=Math.max(0,coarse-step);at<=Math.min(end,coarse+step);at++){const value=score(at);if(value>best){best=value;position=at;}}
  if(best<.55)return null;
  // Reject a similarly strong unrelated match elsewhere in the same frame.
  for(let at=0;at<=end;at+=step)if(Math.abs(at-position)>rate*.012&&score(at)>best-.12)return null;
  return {offset:position/rate,score:best};
}

export function calibrationMeasurement(observations) {
  const clean=observations.filter(o=>Number.isFinite(o.delay)&&o.delay>=0&&o.delay<=1&&o.score>=.55).sort((a,b)=>a.delay-b.delay);
  for(let size=clean.length;size>=4;size--)for(let i=0;i+size<=clean.length;i++){
    const group=clean.slice(i,i+size),delays=group.map(o=>o.delay),middle=calibrationMedian(delays);
    if(delays.at(-1)-delays[0]>.06||calibrationMedian(delays.map(x=>Math.abs(x-middle)))>.015)continue;
    return {milliseconds:Math.round(middle*1000),matches:size,spreadMs:Math.round((delays.at(-1)-delays[0])*1000)};
  }
  return null;
}

export function calibrationMarkup() {
  return `<dialog id="b-vocal-calibration" class="vocal-calibration-dialog" aria-labelledby="b-calibration-title"><div class="dialog-header"><div><p class="eyebrow">YOUR HEADPHONES. YOUR TIMING.</p><h2 id="b-calibration-title">Check headphone timing</h2></div><button id="b-calibration-close" class="close-button" aria-label="Close headphone timing check">×</button></div><p>Keep your headphones connected and awake. Hold an earpiece near the microphone you’re using so it can hear the test sounds.</p><ol><li>Use a quiet spot and a comfortable listening volume.</li><li>Stay quiet while five short chirps play—about seven seconds.</li><li>Put the earpiece back on when the check finishes.</li></ol><p id="b-calibration-state" role="status">The app will measure and apply the timing automatically. No singing or tapping needed.</p><progress id="b-calibration-progress" max="5" value="0" aria-label="Timing-check sounds measured" hidden></progress><p class="band-help">If the microphone cannot hear the chirps clearly, no new timing is saved. Your voice and test audio stay on this device. Run this again after changing headphones.</p><div class="dialog-actions"><button id="b-calibration-forget" class="text-button" hidden>Clear saved check</button><button id="b-calibration-start" class="button primary">Start automatic check</button><button id="b-calibration-done" class="button secondary">Done</button></div></dialog>`;
}

export class VocalCalibration {
  constructor(singing,environment=globalThis) {
    this.singing=singing;this.practice=singing.practice;this.q=singing.q;this.environment=environment;this.generation=0;this.routeGeneration=0;this.sessionProfiles=new Map();this.sources=[];
    const q=this.q;
    q('b-vocal-calibrate').onclick=()=>{this.render();q('b-vocal-calibration').showModal();};
    q('b-calibration-start').onclick=()=>this.busy?this.stop('Check cancelled. Your previous timing is unchanged.'):this.practice.attempt(()=>this.start());
    q('b-calibration-close').onclick=q('b-calibration-done').onclick=()=>{this.stop();q('b-vocal-calibration').close();};
    q('b-vocal-calibration').addEventListener('cancel',()=>this.stop());
    q('b-calibration-forget').onclick=()=>this.forget();
    environment.navigator?.mediaDevices?.addEventListener?.('devicechange',()=>this.deviceChanged());
  }
  message(text){this.q('b-calibration-state').textContent=text;}
  render() {
    const p=this.practice,q=this.q,blocked=!!p.session||!!p.rooms.room;
    q('b-vocal-calibrate').disabled=blocked||this.singing.warmup.running||this.singing.warmup.finding||this.singing.warmup.busy;
    q('b-calibration-start').disabled=blocked;
    q('b-calibration-start').textContent=this.busy?'Cancel check':'Start automatic check';
    q('b-calibration-forget').disabled=this.busy||blocked;
    q('b-calibration-forget').hidden=!this.profile;
    q('b-calibration-progress').hidden=!this.busy;
    this.singing.renderLatency?.();
  }
  profiles() {try{const value=JSON.parse(this.environment.localStorage?.getItem(CALIBRATION_STORAGE)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  saveProfiles(profiles){
    const now=this.environment.Date.now(),recent=Object.fromEntries(Object.entries(profiles).filter(([,p])=>p&&now-p.at>=0&&now-p.at<7*86400000).sort((a,b)=>b[1].at-a[1].at).slice(0,8));
    try{this.environment.localStorage?.setItem(CALIBRATION_STORAGE,JSON.stringify(recent));}catch{}
  }
  async route() {
    const mic=this.singing.microphone,context=this.practice.audio.context;
    const settings=mic.stream?.getAudioTracks()[0]?.getSettings?.()||{};
    let outputs=[];try{outputs=(await this.environment.navigator?.mediaDevices?.enumerateDevices?.()||[]).filter(d=>d.kind==='audiooutput');}catch{}
    const output=outputs.find(d=>d.deviceId==='default'),sink=typeof context?.sinkId==='string'?context.sinkId:'';
    const outputName=output?.label||'',restorable=!!settings.deviceId&&!!(outputName&&!/^(default|system default|communications)$/i.test(outputName)||sink&&sink!=='default');
    const key=JSON.stringify([settings.deviceId||'',settings.groupId||'',mic.context?.sampleRate,settings.echoCancellation,settings.noiseSuppression,settings.autoGainControl,sink,outputName,Math.round((context?.outputLatency||0)*50)]);
    return {key,restorable};
  }
  async microphoneChanged(state) {
    const generation=++this.routeGeneration;
    if(state==='requesting'){this.render();return;}
    if(state!=='listening'){
      const message=this.busy?(state==='denied'?'Allow microphone access in the browser, then try the timing check again.':state==='unsupported'?'Open the school’s HTTPS link in Safari or Chrome to use the microphone check.':'Microphone interrupted. Enable it and start the check again.'):undefined;
      this.stop(message);this.profile=null;this.render();return;
    }
    const route=await this.route();
    if(generation!==this.routeGeneration||this.singing.microphone.state!=='listening')return;
    this.currentRoute=route;
    const saved=this.sessionProfiles.get(route.key)||(route.restorable?this.profiles()[route.key]:null);
    if(saved&&Number.isInteger(saved.milliseconds)&&saved.milliseconds>=0&&saved.milliseconds<=1000&&this.environment.Date.now()-saved.at>=0&&this.environment.Date.now()-saved.at<7*86400000){
      this.apply(saved);this.message('Your saved timing check is applied. Run it again after changing headphones.');
    }else{this.profile=null;this.singing.microphone.setCalibration(null);this.message('The app will measure and apply the timing automatically. No singing or tapping needed.');this.render();}
  }
  apply(profile) {
    this.profile=profile;this.singing.microphone.setCalibration(profile.milliseconds/1000);
    this.q('b-vocal-delay').value='0';this.q('b-vocal-delay').oninput?.();this.render();
  }
  forget() {
    if(this.busy||this.practice.session)return;
    if(this.currentRoute){this.sessionProfiles.delete(this.currentRoute.key);const saved=this.profiles();delete saved[this.currentRoute.key];this.saveProfiles(saved);}
    this.profile=null;this.singing.microphone.setCalibration(null);this.message('Saved check cleared. The browser’s timing estimate is in use.');this.render();
  }
  deviceChanged() {
    this.routeGeneration++;this.sessionProfiles.clear();
    if(this.currentRoute){const saved=this.profiles();delete saved[this.currentRoute.key];this.saveProfiles(saved);}
    this.profile=null;this.currentRoute=null;this.singing.microphone.setCalibration(null);
    if(this.trials)this.stop('Audio setup changed. Start a new timing check.');
    else this.message('Audio setup changed. Run the timing check again with your headphones connected.');
    this.render();
  }
  stop(message) {
    const cancelPermission=this.busy&&this.singing.microphone.state==='requesting';
    this.generation++;this.busy=false;this.trials=null;
    for(const {source,gain} of this.sources){try{source.stop();}catch{}source.disconnect();gain.disconnect();}this.sources=[];
    if(this.analyser){try{this.singing.microphone.source?.disconnect(this.analyser);}catch{}this.analyser.disconnect();}
    this.analyser=this.buffer=null;
    if(cancelPermission)this.singing.microphone.stop();
    if(message)this.message(message);
    this.render();
  }
  async start() {
    if(this.practice.session||this.practice.rooms.room){this.message('Pause the song and leave the jam to check your own headphones.');return;}
    this.singing.warmup.stop();this.stop();const generation=this.generation;
    this.busy=true;this.message('Getting your microphone and headphones ready…');this.render();
    try {
      await Promise.all([this.practice.audio.ready(),this.singing.microphone.start()]);
      if(generation!==this.generation)return;
      await this.practice.audio.ready();
      if(generation!==this.generation)return;
      const mic=this.singing.microphone;
      if(mic.state!=='listening'){this.stop('The microphone is needed for this check. Enable it, then try again.');return;}
      this.currentRoute=await this.route();if(generation!==this.generation)return;
      this.analyser=mic.context.createAnalyser();this.analyser.fftSize=Math.min(32768,2**Math.ceil(Math.log2(mic.context.sampleRate*.22)));
      mic.source.connect(this.analyser);this.buffer=new Float32Array(this.analyser.fftSize);
      this.templates=[calibrationTemplate(mic.context.sampleRate,0),calibrationTemplate(mic.context.sampleRate,1)];
      const audio=this.practice.audio,context=audio.context,start=context.currentTime+.6;
      this.trials=Array.from({length:5},(_,i)=>({at:start+i*1.3,variant:i%2}));this.observations=[];this.lastRead=-Infinity;
      for(const trial of this.trials){
        const samples=calibrationSignal(context.sampleRate,trial.variant),buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.getChannelData(0).set(samples);
        const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.18;
        source.connect(gain);gain.connect(audio.output||context.destination);source.addEventListener('ended',()=>{source.disconnect();gain.disconnect();},{once:true});
        this.sources.push({source,gain});source.start(trial.at);
      }
      this.q('b-calibration-progress').value=0;this.message('Stay quiet. Let the microphone hear all five chirps.');this.render();
    }catch(error){if(generation===this.generation)this.stop('The check could not start. Reconnect your headphones and try again.');throw error;}
  }
  draw() {
    this.render();if(!this.busy||!this.trials)return;
    const mic=this.singing.microphone,audio=this.practice.audio;
    if(mic.state!=='listening'||audio.context?.state!=='running'||mic.context?.state!=='running'||this.practice.rooms.room||this.practice.session){this.stop('Audio was interrupted. Start the check again.');return;}
    const now=this.environment.performance.now();if(now-this.lastRead<30)return;this.lastRead=now;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const clock=audio.audibleTime(now),pending=this.trials.filter(t=>!t.measured&&clock>=t.at&&clock<t.at+1.1);
    for(const trial of pending){
      const match=findCalibrationSignal(this.buffer,mic.context.sampleRate,this.templates[trial.variant]);if(!match)continue;
      const arrived=now-(this.buffer.length/mic.context.sampleRate-match.offset)*1000,delay=audio.audibleTime(arrived)-trial.at;
      if(delay<0||delay>1)continue;
      trial.measured=true;this.observations.push({delay,score:match.score});this.q('b-calibration-progress').value=this.observations.length;
      this.message('Heard '+this.observations.length+' of 5 test sounds. Keep the earpiece near the microphone.');
    }
    if(clock<this.trials.at(-1).at+1.1)return;
    const result=calibrationMeasurement(this.observations),route=this.currentRoute;
    this.stop();
    if(!result){this.message('No reliable timing found. Your previous timing is unchanged. Move the earpiece closer to the active microphone, use a quiet spot, and try again. Some phones filter out the test sounds.');return;}
    const profile={...result,at:this.environment.Date.now()};this.sessionProfiles.set(route.key,profile);
    if(route.restorable){const saved=this.profiles();saved[route.key]=profile;this.saveProfiles(saved);}
    this.apply(profile);this.message('Timing set automatically · '+result.milliseconds+' ms. '+result.matches+' consistent sounds matched. '+(route.restorable?'Saved for this audio setup on this device.':'Kept for this visit; this browser cannot identify the headphone output reliably.')+' Put your earpiece back on and sing.');
  }
}
