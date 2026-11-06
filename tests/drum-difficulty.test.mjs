import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DRUM_DIFFICULTIES,simplifyDrumChart,difficultyDrums} from '../dist/drum-difficulty.mjs';
import {buildTimeline,midiTimeGrid,parseMidiSong,makeMidiChart} from '../dist/midi.mjs';
import {createDemoMidi} from '../dist/demo-data.mjs';
import {createPracticeChart} from '../dist/practice.mjs';
import {PracticeTools} from '../dist/practice-tools.mjs';
import {Judge} from '../dist/engine.mjs';
import {makeRunReport,validateRunReport} from '../dist/run-report.mjs';
import {ClassroomStore,validateSchoolRun} from '../server/classroom.mjs';
import {exportDrumMidi} from '../scripts/drum-midi.mjs';

function difficultyFixture({numerator=4,denominator=4,bpm=120,quarters=16,pickup=0,meters=[]}={}){
 const ppq=480,timeline=buildTimeline(ppq,[{tick:0,microsecondsPerBeat:60000000/bpm}],[{tick:0,numerator,denominator},...meters.map(m=>({...m,tick:m.tick*ppq}))]);
 const song={ppq,timeline,endTick:quarters*ppq,duration:timeline.tickToSeconds(quarters*ppq),title:'Original exercise'},grid=midiTimeGrid(song,pickup);
 const notes=[];const add=(q,drum,velocity=.8)=>{const m=grid.measures.find(m=>q>=m.startQuarter&&q<m.endQuarter);notes.push({id:'n-'+notes.length,quarter:q,tick:Math.round(q*ppq),time:timeline.tickToSeconds(q*ppq),drum,velocity,bar:m.bar,beat:1+(m.beatOffset||0)+(q-m.startQuarter)/(4/m.denominator),status:'pending'});};
 return {song,grid,add,chart:()=>({...grid,notes:[...notes].sort((a,b)=>a.time-b.time)})};
}

test('four drum levels retain original attacks, meter and tempo while reducing lanes and kick triplets',()=>{
 const f=difficultyFixture();
 for(let q=0;q<16;q+=.5)f.add(q,q%2?'hihat-open':'ride');
 for(let q=0;q<16;q+=1/3)f.add(q,'kick');
 for(let q=1;q<16;q+=2){f.add(q,'snare',.9);f.add(q+.25,'snare',.2);f.add(q+.5,'tom1');}
 f.add(0,'crash');f.add(0,'hihat-pedal');const original=f.chart(),before=structuredClone(original),versions=Object.keys(DRUM_DIFFICULTIES).map(level=>simplifyDrumChart(original,level));
 assert.equal(versions.at(-1),original);
 for(let i=0;i<versions.length;i++){
  const c=versions[i];assert.equal(c.duration,original.duration);assert.deepEqual(c.measures,original.measures);assert.deepEqual(c.tempos,original.tempos);assert.deepEqual(c.beats,original.beats);
  assert(c.notes.every(n=>original.notes.some(o=>o.id===n.id&&o.time===n.time&&o.quarter===n.quarter)));
  if(i)assert(c.notes.length>=versions[i-1].notes.length);
 }
 for(const c of versions.slice(0,2))assert(c.notes.every(n=>['kick','snare','hihat'].includes(n.drum)));
 const kicks=versions[0].notes.filter(n=>n.drum==='kick');assert(kicks.length<original.notes.filter(n=>n.drum==='kick').length/2);assert(kicks.every(n=>Math.abs(n.quarter-Math.round(n.quarter))<1e-6));
 for(let i=1;i<kicks.length;i++)assert(kicks[i].time-kicks[i-1].time>=.42-1e-7);
 assert.deepEqual(original,before);
});

test('compound and swung pulses stay musical rather than snapping notes to straight eighths',()=>{
 const compound=difficultyFixture({numerator:12,denominator:8,quarters:12});for(let q=0;q<12;q+=.5)compound.add(q,'ride');
 const basic=simplifyDrumChart(compound.chart(),'beginner'),easy=simplifyDrumChart(compound.chart(),'easy');
 assert.deepEqual(basic.notes.map(n=>n.quarter),[0,1.5,3,4.5,6,7.5,9,10.5]);assert.equal(easy.notes.length,24);
 const swing=difficultyFixture();for(let q=0;q<16;q++){swing.add(q,'ride');swing.add(q+2/3,'ride');}
 assert.equal(simplifyDrumChart(swing.chart(),'easy').notes.length,32);assert.equal(simplifyDrumChart(swing.chart(),'beginner').notes.length,16);
});

test('pickup and irregular bars retain their phase and repeated sections retain the selected level',()=>{
 const f=difficultyFixture({pickup:1.5,quarters:15,meters:[{tick:5.5,numerator:21,denominator:32},{tick:8.125,numerator:3,denominator:4}]});
 for(const m of f.grid.measures)for(let q=m.startQuarter;q<m.endQuarter;q+=.25)f.add(q,'hihat');
 const c=simplifyDrumChart(f.chart(),'beginner');assert(c.notes.some(n=>n.quarter===.5));assert(!c.notes.some(n=>n.quarter===0));
 assert.equal(c.measures[2].denominator,32);const loop=createPracticeChart(c,{enabled:true,startBar:2,endBar:4,repeats:2});assert.equal(loop.drumDifficulty,'beginner');assert.equal(loop.passes[0].from,c.measures[1].time);assert.equal(loop.notes.length,c.notes.filter(n=>n.bar>=2&&n.bar<=4).length*2);
});

test('silent bars remain silent and a fill-only bar becomes one cue at a real stroke',()=>{
 const f=difficultyFixture({quarters:12});for(let q=4;q<8;q+=.25)f.add(q,'tom1');
 const c=simplifyDrumChart(f.chart(),'easy');assert(c.notes.every(n=>n.bar===2));assert.equal(c.notes.length,1);assert.equal(c.notes[0].time,2);assert.equal(c.notes[0].drum,'snare');
});

test('MIDI exports preserve full duration, tempo changes, attack times and imported drum voices',()=>{
 const source=parseMidiSong(createDemoMidi()),original=makeMidiChart(source,source.selected);
 for(const level of Object.keys(DRUM_DIFFICULTIES)){
  const chart=simplifyDrumChart(original,level),song=parseMidiSong(exportDrumMidi(source,chart)),restored=makeMidiChart(song,song.selected);
  assert.equal(song.duration,source.duration);assert.deepEqual(song.timeline.tempos,source.timeline.tempos);assert.equal(restored.notes.length,chart.notes.length);
  for(let i=0;i<chart.notes.length;i++){assert.equal(restored.notes[i].time,chart.notes[i].time);assert.equal(restored.notes[i].drum,chart.notes[i].drum);}
 }
 const f=difficultyFixture({quarters:8,pickup:1.5});for(let q=0;q<8;q+=.5)f.add(q,'hihat');const restored=parseMidiSong(exportDrumMidi(f.song,simplifyDrumChart(f.chart(),'easy')));assert.equal(restored.timeline.signatures[1].tick,720);assert.equal(restored.duration,4);
});

test('individual practice applies difficulty before loops and focus, and only displayed kit pieces are scored',()=>{
 const f=difficultyFixture();for(let q=0;q<16;q+=.5){f.add(q,'ride');f.add(q,'kick');}for(let q=1;q<16;q+=2)f.add(q,'snare');
 const fields={},p=Object.assign(Object.create(PracticeTools.prototype),{options:{enabled:true,startBar:2,endBar:3,repeats:2,focus:'all',drumDifficulty:'beginner'},el:id=>fields[id]??={classList:{add(){},remove(){}}}});
 const chart=p.build(f.chart());assert.equal(p.valid,true);assert.equal(chart.drumDifficulty,'beginner');assert.equal(chart.practice.repeats,2);assert.deepEqual(chart.focusDrums,['kick','snare','hihat']);assert.match(fields['practice-summary'].textContent,/Beginner/);assert.equal(difficultyDrums('original'),null);
 p.options.focus='kick';const foot=p.build(f.chart());assert(foot.notes.every(n=>n.drum==='kick'));assert.deepEqual(foot.focusDrums,['kick']);
});

test('reports and saved school results retain the difficulty and reject mismatched or unknown levels',()=>{
 const chart=createPracticeChart(simplifyDrumChart(makeMidiChart(parseMidiSong(createDemoMidi()),['1:9']),'beginner')),judge=new Judge(chart);judge.advance(Infinity);
 const report=makeRunReport(judge),summary=judge.summary(),record={id:randomUUID(),sourceKind:'personal',sourceId:'fixture',title:'Original exercise',hits:0,total:summary.total,extras:0,bestStreak:0,meanMs:null,meanAbsMs:null,bpm:80,endBpm:80,tolerance:140,focus:'all',section:'1–4',full:true,repeats:1,drums:summary.byDrum,drumDifficulty:'beginner'};
 const saved=validateSchoolRun(record);assert.equal(saved.drumDifficulty,'beginner');assert.equal(validateRunReport(report).drumDifficulty,'beginner');assert.equal(ClassroomStore.prototype.checkedReport(saved,report).drumDifficulty,'beginner');
 assert.throws(()=>ClassroomStore.prototype.checkedReport({...saved,drumDifficulty:'easy'},report),/difficulty/);assert.throws(()=>validateSchoolRun({...record,drumDifficulty:'anything'}),/Choose/);assert.throws(()=>validateRunReport({...report,drumDifficulty:'anything'}),/Choose/);assert.throws(()=>simplifyDrumChart(chart,'anything'),/Choose/);
});
