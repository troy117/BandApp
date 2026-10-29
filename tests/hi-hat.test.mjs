import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUMS, DEFAULT_BINDINGS, Judge, validateBindings, mappedDrum, assignBinding } from '../dist/engine.mjs';
import { DEFAULT_MIDI_MAPPING, validateMidiMapping, learnMidiNote, midiNote } from '../dist/midi-input.mjs';
import { parseMidiSong, makeMidiChart } from '../dist/midi.mjs';
import { drumHighwayLanes, drumHighwayLane, drumLaneOrder } from '../dist/drum-lanes.mjs';
import { createPracticeChart } from '../dist/practice.mjs';
import { createNotation, drawSheet, STAFF_POSITIONS } from '../dist/notation.mjs';
import { makeRunReport, validateRunReport } from '../dist/run-report.mjs';
import { validateSchoolRun } from '../server/classroom.mjs';
import { hiHatMidi } from './hi-hat-fixture.mjs';
const song=parseMidiSong(hiHatMidi(),'synthetic-hats.mid');
const voices=['hihat','hihat-open','hihat-pedal','hihat','hihat-open'];
const chart=mapping=>makeMidiChart(song,song.selected,mapping);

test('TD-17 bow/edge notes and imported MIDI distinguish closed, open and pedal targets',()=>{
  assert.deepEqual(chart().notes.map(n=>n.drum),voices);
  for(const channel of [0,9,15])assert.deepEqual([42,46,44,22,26].map(pitch=>{const note=midiNote({data:[0x90+channel,pitch,100],timeStamp:100});return mappedDrum(note.pitch,DEFAULT_MIDI_MAPPING[note.pitch]);}),voices);
  const judge=new Judge(chart());for(const note of judge.chart.notes)assert.equal(judge.strike(note.drum,note.time,'midi').type,'hit');
  assert.equal(judge.summary().hits,5);assert.equal(judge.summary().extras,0);
  const report=makeRunReport(judge);assert.deepEqual(validateRunReport(report).notes.map(n=>n[3]),voices);
  assert.deepEqual(drumHighwayLanes(chart()).map(d=>d.drumId),['hihat','hihat-open','hihat-pedal']);
});

test('the wrong hi-hat voice cannot match a closed, open or pedal target',()=>{
  for(const expected of ['hihat','hihat-open','hihat-pedal'])for(const played of ['hihat','hihat-open','hihat-pedal'].filter(id=>id!==expected)){
    const source=chart();source.notes=[{...source.notes[0],drum:expected}];const judge=new Judge(source);
    assert.equal(judge.strike(played,0).type,'extra');assert.equal(judge.summary().hits,0);judge.advance(1);assert.equal(judge.summary().misses,1);
  }
  const focused=createPracticeChart(chart(),{focus:'cymbals'});assert.deepEqual(focused.notes.map(n=>n.drum),voices);assert.ok(['hihat','hihat-open','hihat-pedal'].every(id=>focused.focusDrums.includes(id)));
});

test('legacy generic hi-hat maps split known pitches without changing custom drums or ignored notes',()=>{
  const legacy={22:'hihat',26:'hihat',42:'hihat',44:'hihat',46:'hihat',60:'snare',61:'ignore',62:'hihat'};
  const before=structuredClone(legacy),mapping=validateMidiMapping(legacy);
  assert.deepEqual(chart(legacy).notes.map(n=>n.drum),voices);assert.equal(mapping[60],'snare');assert.equal(mapping[61],'ignore');assert.equal(mapping[62],'hihat-closed');assert.deepEqual(legacy,before);
  assert.deepEqual(validateMidiMapping(mapping),mapping);
  const learned=learnMidiNote(mapping,46,'hihat');assert.equal(learned[46],'hihat-closed');assert.equal(mappedDrum(46,validateMidiMapping(learned)[46]),'hihat');
  assert.equal(chart(learned).notes[1].drum,'hihat');assert.equal(drumHighwayLane(chart(learned).notes[1]),'hihat');
  assert.equal(chart({...legacy,46:'snare'}).notes[1].drum,'snare');
});

test('new keyboard defaults differ and migration preserves all custom keys with collision-free additions',()=>{
  assert.deepEqual([DEFAULT_BINDINGS.hihat,DEFAULT_BINDINGS['hihat-open'],DEFAULT_BINDINGS['hihat-pedal']],[['KeyD'],['KeyE'],['KeyR']]);
  const old=structuredClone(DEFAULT_BINDINGS);delete old['hihat-open'];delete old['hihat-pedal'];old.kick=['KeyE'];old.snare=['KeyR'];old.hihat=['KeyH'];old.ride=[];
  const migrated=validateBindings(old);for(const [id,keys] of Object.entries(old))assert.deepEqual(migrated[id],keys);
  const keys=Object.values(migrated).flat();assert.equal(keys.length,new Set(keys).size);assert.equal(migrated['hihat-open'].length,1);assert.equal(migrated['hihat-pedal'].length,1);assert.deepEqual(validateBindings(migrated),migrated);
  assert.equal(assignBinding(migrated,'hihat-open','KeyH').ok,false);
  const laneOrder=['snare','kick','hihat','tom1','tom2','tom3','crash','ride'];assert.deepEqual(drumLaneOrder(laneOrder),['snare','kick','hihat','hihat-open','hihat-pedal','tom1','tom2','tom3','crash','ride']);
});

test('pedal CC4, note-off and velocity-zero messages never produce a hit',()=>{
  for(const pitch of [22,26,42,44,46])for(const data of [[0x99,pitch,0],[0x89,pitch,127]])assert.equal(midiNote({data}),null);
  for(const channel of [0,9,15])for(const value of [0,32,64,96,127])assert.equal(midiNote({data:[0xb0+channel,4,value]}),null);
  assert.equal(midiNote({data:[0x99,44,1]}).pitch,44);
  assert.equal(chart().notes.length,5);
});

test('notation retains every hi-hat onset and draws open and pedal marks with finite geometry',()=>{
  const source=chart(),score=createNotation(source);assert.deepEqual(score.groups.flatMap(g=>g.notes.map(n=>n.drum)),voices);
  assert.equal(STAFF_POSITIONS['hihat-open'],STAFF_POSITIONS.hihat);assert.ok(STAFF_POSITIONS['hihat-pedal']>4);
  const context=new Proxy({},{get:()=> (...args)=>{assert.ok(args.every(value=>typeof value!=='number'||Number.isFinite(value)));}});
  for(const width of [320,1000])drawSheet(context,{width,height:347,dpr:1},score,source,0,false);
});

test('school summaries accept all ten distinct voices without changing older hi-hat results',()=>{
  const run={id:crypto.randomUUID(),sourceKind:'builtin',sourceId:'rock',title:'Synthetic full kit',hits:10,total:10,extras:0,bestStreak:10,repeats:1,tolerance:140,focus:'all',bpm:80,endBpm:80,meanMs:0,meanAbsMs:0,section:'1–1',full:true,drums:DRUMS.map(d=>({id:d.id,hits:1,total:1,meanMs:0,meanAbsMs:0}))};
  assert.equal(validateSchoolRun(run).drums.length,10);
  const old={...run,hits:1,total:1,bestStreak:1,drums:[{id:'hihat',hits:1,total:1,meanMs:0,meanAbsMs:0}]};assert.deepEqual(validateSchoolRun(old).drums,old.drums);
});
