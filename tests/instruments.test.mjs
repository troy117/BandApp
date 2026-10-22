import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchJudge, SessionClock, pitchedMidiMessage, pitchName, DEFAULT_PIANO_BINDINGS, pianoBindings, bindPianoKey } from '../dist/instruments.mjs';
import { builtinArrangement, importedArrangement, arrangementParts, partCsv } from '../dist/arrangements.mjs';
import { parseMidiSong } from '../dist/midi.mjs';
import { MidiDrumInput } from '../dist/midi-input.mjs';
import { duetMidi } from './duet-fixture.mjs';

test('keyboard scoring distinguishes pitch, octave, early/late, extras and misses without double-counting a wrong note', () => {
  const chart = builtinArrangement().parts.find(part=>part.instrument==='keyboard').chart;
  const judge = new PitchJudge(chart);
  assert.equal(judge.strike(60, -0.08).type, 'hit');
  assert.ok(judge.chart.notes[0].errorMs < 0);
  assert.equal(judge.strike(60, 0.83).type, 'hit');
  assert.ok(judge.chart.notes[1].errorMs > 0);
  assert.equal(judge.strike(76, 1.5).type, 'wrong');
  assert.equal(judge.strike(64, 1.85).type, 'extra');
  judge.advance(Infinity);
  const score = judge.summary();
  assert.equal(score.hits,2);assert.equal(score.wrong,1);assert.equal(score.misses,29);assert.equal(score.extras,1);
  assert.equal(score.hits+score.wrong+score.misses,score.total);
  assert.ok(score.meanAbsMs>Math.abs(score.meanMs));
  const csv=partCsv(judge);assert.match(csv,/keyboard,64,76/);assert.match(csv,/-80/);assert.match(csv,/extra/);
});
test('keyboard MIDI messages retain pitch/channel/timestamp and release both note-off encodings', () => {
  assert.deepEqual(pitchedMidiMessage({data:[0x92,60,100],timeStamp:123}),{type:'on',pitch:60,velocity:100/127,channel:3,timestamp:123});
  assert.equal(pitchedMidiMessage({data:[0x82,60,80],timeStamp:124}).type,'off');
  assert.equal(pitchedMidiMessage({data:[0x92,60,0],timeStamp:125}).type,'off');
  for(const data of [[0xb0,64,127],[0xf0,0,0],[0x90,128,20],[0x90,60,-1],[0x90,60],[0x90,60,1,0]])assert.equal(pitchedMidiMessage({data}),null);
  assert.equal(pitchName(60),'C4');assert.equal(pitchName(72),'C5');
});
test('keyboard controls validate saved data, reject collisions and preserve drum transport shortcuts', () => {
  assert.deepEqual(pianoBindings(null),DEFAULT_PIANO_BINDINGS);
  const result=bindPianoKey(DEFAULT_PIANO_BINDINGS,60,'KeyZ');assert.equal(result[60],'KeyZ');
  assert.throws(()=>bindPianoKey(result,61,'KeyZ'),/already assigned/);
  assert.throws(()=>bindPianoKey(result,60,'Enter'),/Choose/);
  const saved=pianoBindings({60:'KeyZ',61:'KeyZ',62:'Escape'});
  assert.equal(saved[60],'KeyZ');assert.notEqual(saved[61],'KeyZ');assert.notEqual(saved[62],'Escape');
});
test('session clock ignores invalid samples and favors low-delay measurements without grading packet arrival', () => {
  const clock=new SessionClock();
  assert.equal(clock.status.ready,false);assert.equal(clock.add(20,10,100),false);
  for(const sent of [100,200,300])assert.equal(clock.add(sent,sent+10,sent+1005),true);
  assert.equal(clock.status.ready,true);assert.equal(clock.localAt(2000),1000);assert.equal(clock.serverAt(1000),2000);
  clock.add(400,1200,2000);assert.equal(clock.status.offset,1000);
  const slow=new SessionClock();for(let i=0;i<4;i++)slow.add(i*1000,i*1000+400,i*1000+200);
  assert.equal(slow.status.ready,false);
});
test('provided duets share one timeline while keeping keyboard pitches out of drum charts', () => {
  for(const id of ['duet-first','duet-step','duet-long']){
    const arr=builtinArrangement(id),[drums,keys]=arr.parts;
    assert.equal(drums.chart.duration,keys.chart.duration);assert.deepEqual(drums.chart.beats,keys.chart.beats);
    assert.ok(drums.chart.notes.every(note=>typeof note.drum==='string'&&note.pitch===undefined));
    assert.ok(keys.chart.notes.every(note=>Number.isInteger(note.pitch)&&note.drum===undefined));
    assert.equal(keys.chart.notes[0].time,drums.chart.notes[0].time);
  }
});
test('imported arrangements preserve keyboard releases, shared meter and scaling; old library metadata detects piano', () => {
  const song=parseMidiSong(duetMidi(),'Duet.mid'),keys=song.parts.find(part=>part.channel===1);
  assert.equal(keys.notes[0].endTick,240);assert.equal(keys.notes[1].endTick,720);
  const parts=[{id:'drums',instrument:'drums',name:'Drums',selected:[song.parts.find(p=>p.channel===10).id]},{id:'keyboard',instrument:'keyboard',name:'Keys',selected:[keys.id]}];
  const arr=importedArrangement(song,{parts,selected:parts[0].selected,timeScale:2});
  assert.equal(arr.parts[1].chart.notes[0].duration,0.5);
  assert.equal(arr.parts[1].chart.notes[1].time,1);
  assert.deepEqual(arr.parts[0].chart.measures,arr.parts[1].chart.measures);
  const legacy=importedArrangement(song,{selected:parts[0].selected,timeScale:2,mapping:{36:'tom3'}});
  assert.equal(legacy.parts.length,2);assert.equal(legacy.parts[0].chart.notes[0].drum,'tom3');
  assert.equal(legacy.parts[1].chart.notes[0].pitch,60);assert.equal(legacy.parts[1].chart.notes[0].duration,0.5);
  assert.deepEqual(legacy.parts[0].chart.measures,legacy.parts[1].chart.measures);
  assert.equal(importedArrangement(song,{parts:[parts[0]]}).parts.length,1);
  assert.throws(()=>arrangementParts([{...parts[0],id:'<bad>'}]),/Invalid/);
  assert.throws(()=>importedArrangement(song,{parts:[{...parts[1],selected:['99:0']}]}),/missing/);
});
test('selected keyboard ports use the shared MIDI lifecycle without auto-selecting a drumkit among multiple devices', async () => {
  const listeners=new Map(), makePort=(id,name)=>({id,name,state:'connected',open:async()=>{},close:async()=>{},addEventListener:(type,fn)=>listeners.set(id,fn),removeEventListener:()=>listeners.delete(id)});
  const kit=makePort('kit','TD-17'),keys=makePort('keys','Piano');
  const access={inputs:new Map([[kit.id,kit],[keys.id,keys]]),addEventListener:()=>{},removeEventListener:()=>{}},notes=[];
  const input=new MidiDrumInput({instrument:'keyboard',parseMessage:pitchedMidiMessage,secure:true,navigator:{requestMIDIAccess:async options=>{assert.equal(options.sysex,false);return access;}},onNote:note=>notes.push(note)});
  await input.connect();assert.equal(input.port,null);
  await input.select('keys');listeners.get('keys')({data:[0x90,60,0],timeStamp:50});
  assert.equal(notes[0].type,'off');assert.equal(listeners.has('kit'),false);input.disconnect();assert.equal(listeners.size,0);
});
