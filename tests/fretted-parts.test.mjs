import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFrettedPart,DROP_D_STRINGS,retunePart,tabTechnique} from '../dist/fretted-parts.mjs';
import {parseMidiSong,midiTimeGrid,makeMidiChart,buildTimeline} from '../dist/midi.mjs';
import {importedArrangement} from '../dist/arrangements.mjs';
import {createDemoMidi} from '../dist/demo-data.mjs';
import {createPracticeChart,backingSegments} from '../dist/practice.mjs';
import {canListenInBackground,listeningTime,InstrumentListening} from '../dist/instrument-listening.mjs';
import {BandImport} from '../dist/band-import.mjs';
import {duetMidi} from './duet-fixture.mjs';
import {midiPositionTime} from '../dist/sync.mjs';
import {BandPractice} from '../dist/band-practice.mjs';

const tabPart=()=>({id:'guitar-rhythm',instrument:'guitar',name:'Rhythm',selected:['1:0'],tuning:DROP_D_STRINGS.guitar,tablature:{version:1,notes:[{time:0,duration:.5,pitch:41,string:5,fret:3,palmMute:true},{time:.5,duration:.4,pitch:43,string:5,fret:5,slide:1}]}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('separate guitar parts keep source strings, Drop D frets and techniques through alignment',()=>{
 const song=parseMidiSong(duetMidi()),rhythm=tabPart(),lead={...tabPart(),id:'guitar-lead',name:'Lead'};
 const result=importedArrangement(song,{parts:[rhythm,lead],timeScale:1.25});
 assert.deepEqual(result.parts.map(p=>p.id),['guitar-rhythm','guitar-lead']);
 for(const p of result.parts){assert.equal(p.chart.fingeringSource,'score');assert.equal(p.chart.notes[0].fret,3);assert.equal(p.chart.notes[0].string,5);assert.equal(p.chart.notes[0].palmMute,true);assert.equal(p.chart.notes[0].bar,1);near(p.chart.notes[1].time,.625);near(p.chart.notes[1].duration,.5);}
 const mapped=importedArrangement(song,{parts:[rhythm],timingMap:{version:1,points:[[0,1],[song.duration,song.duration*1.2+1]]}}).parts[0].chart;
 near(mapped.notes[1].time,.6);near(mapped.notes[1].duration,.48);assert.equal(mapped.notes[1].slide,1);
 const retuned=retunePart(rhythm,[64,59,55,50,45,40]);assert.equal(retuned.tablature.notes[0].pitch,41);assert.equal(retuned.tablature.notes[0].fret,1);assert.equal(rhythm.tablature.notes[0].fret,3);
 assert.deepEqual(tabTechnique({slide:64}),{label:'pick scrape',up:false});assert.equal(tabTechnique({slide:1,pitch:50},{pitch:48}).up,false);
});

test('source tablature rejects impossible strings, mismatched pitches and conflicting attacks',()=>{
 for(const mutate of [p=>p.tuning.reverse(),p=>p.tablature.notes[0].pitch++,p=>p.tablature.notes[0].string=8,p=>p.tablature.notes.push({...p.tablature.notes[1]}),p=>p.tablature.notes[0].duration=-1]){const p=structuredClone(tabPart());mutate(p);assert.throws(()=>validateFrettedPart(p));}
 assert.throws(()=>validateFrettedPart({...tabPart(),instrument:'keyboard'}));
});

test('pickup restores beat phase without moving MIDI notes, and loops use the full short measure',()=>{
 const song=parseMidiSong(createDemoMidi()),original=makeMidiChart(song,song.selected),grid=midiTimeGrid(song,1.5),chart=makeMidiChart(song,song.selected,{},1.5);
 assert.equal(grid.measures[0].endQuarter,1.5);assert.equal(grid.measures[1].startQuarter,1.5);assert.equal(grid.beats[0].quarter,.5);assert.equal(grid.beats[0].beat,4);assert.equal(grid.beats[0].downbeat,false);assert.equal(grid.beats[1].quarter,1.5);assert.equal(grid.beats[1].downbeat,true);
 near(midiPositionTime(grid,1,4),.25);near(midiPositionTime(grid,2,1),.75);assert.throws(()=>midiPositionTime(grid,1,1),/before/);
 assert.deepEqual(chart.notes.map(n=>n.time),original.notes.map(n=>n.time));
 const loop=createPracticeChart(chart,{enabled:true,startBar:1,endBar:1,repeats:2});near(loop.duration,1.5);assert.equal(loop.passes[0].from,0);near(loop.beats[0].time,.25);assert.equal(loop.notes[0].time,0);
 assert.throws(()=>midiTimeGrid(song,4),/shorter/);
});

test('bar grids and loops honor changing 3/4 and 7/8 meters with a pickup',()=>{
 const ppq=480,timeline=buildTimeline(ppq,[],[{tick:0,numerator:3,denominator:4},{tick:ppq*7,numerator:7,denominator:8}]);
 const song={title:'Meters',ppq,timeline,endTick:ppq*14,duration:7};
 const grid=midiTimeGrid(song,1);assert.deepEqual(grid.measures.map(m=>[m.startQuarter,m.endQuarter]),[[0,1],[1,4],[4,7],[7,10.5],[10.5,14]]);
 assert.equal(grid.beats.filter(b=>b.bar===4).length,7);
 const loop=createPracticeChart({...grid,notes:[]},{enabled:true,startBar:4,endBar:5,repeats:2},{allowEmpty:true});assert.equal(loop.duration,7);assert.equal(loop.numerator,7);assert.equal(loop.denominator,8);assert.equal(loop.notes.length,0);
});

test('seeking a repeated backing clips the current pass and preserves later passes',()=>{
 const source=makeMidiChart(parseMidiSong(createDemoMidi()),['1:9']),chart=createPracticeChart(source,{enabled:true,startBar:1,endBar:2,repeats:4}),backing={offset:0,buffer:{duration:100}};
 const clips=backingSegments(chart,backing,5);assert.equal(clips.length,3);near(clips[0].when,5);near(clips[0].offset,1);near(clips[0].duration,3);near(clips[1].when,8);near(clips[1].offset,0);
});

test('only unscored solo listening may continue in a hidden tab',()=>{
 for(const instrument of ['guitar','bass'])assert.equal(canListenInBackground({part:{instrument}}),true);
 assert.equal(canListenInBackground({listen:true,part:{instrument:'keyboard'}}),true);
 for(const session of [null,{part:{instrument:'keyboard'}},{part:{instrument:'vocals'}},{takeId:'take',listen:true,part:{instrument:'guitar'}},{teacher:true,listen:true}])assert.equal(canListenInBackground(session),false);
 assert.equal(listeningTime(999,120),119.95);assert.equal(listeningTime(-2,120),0);
});

test('teacher edits retain both guitar definitions and original tablature unless tracks change',()=>{
 const rhythm=tabPart(),lead={...tabPart(),id:'guitar-lead',name:'Lead',selected:['2:0']},selects=[{value:rhythm.id,dataset:{bandTrack:'1:0'}},{value:lead.id,dataset:{bandTrack:'2:0'}}];
 const p=Object.assign(Object.create(BandImport.prototype),{draft:{partDefinitions:[rhythm,lead]},q:id=>({querySelectorAll:()=>selects,querySelector:()=>null,value:''})});
 const kept=p.readParts();assert.equal(kept.length,2);assert.deepEqual(kept[0].tablature,rhythm.tablature);
 selects[1].value=rhythm.id;assert.equal(p.readParts()[0].tablature,undefined);
});

test('resumed listening uses the selected position once and cancellation prevents a late start',async()=>{
 const began=[],chart={duration:100,countInBeats:4,countInBeatSeconds:.5},p=Object.assign(Object.create(BandPractice.prototype),{mode:'guitar',part:{instrument:'guitar'},rooms:{},school:{},token:0,audio:{context:{currentTime:50}},listening:{position:12},prepareAudio:async()=>{},playChart:()=>chart,begin:(at,options)=>began.push({at,options})});
 await p.play(true);near(began[0].at,38.18);assert.equal(began[0].options.from,12);assert.equal(began[0].options.skipCountIn,true);
 let resolve;p.prepareAudio=()=>new Promise(done=>resolve=done);const pending=p.play(true);p.token++;resolve();await pending;assert.equal(began.length,1);
});

test('pause preserves the audible position and slider dragging is not overwritten by playback updates',()=>{
 const nodes=new Map(),q=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',append(){}});return nodes.get(id);},p={q,part:{instrument:'guitar',chart:{bars:30}},rooms:{},audio:{audibleTime:()=>50},session:{part:{instrument:'guitar'},startAt:10,judge:{chart:{duration:100}}},playChart:()=>({duration:100}),attempt:fn=>fn(),stop(){this.session=null;}};
 const control=new InstrumentListening(p);control.pause();assert.equal(control.position,40);assert.equal(q('b-seek-time').textContent,'0:40 / 1:40');
 p.session={part:{instrument:'guitar'},startAt:10,judge:{chart:{duration:100}}};q('b-seek').value='65';q('b-seek').oninput();control.update();assert.equal(q('b-seek').value,'65');assert.equal(q('b-seek-time').textContent,'1:05 / 1:40');
});

