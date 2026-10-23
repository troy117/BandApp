import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, Judge } from '../dist/engine.mjs';
import { PitchJudge } from '../dist/instruments.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';
import { createPracticeChart, backingSegments } from '../dist/practice.mjs';
import { stoppedJudge, makeRunReport, validateRunReport, reportSelection } from '../dist/run-report.mjs';
import { DEFAULT_LANE_ORDER, drumLaneOrder, orderedDrums } from '../dist/drum-lanes.mjs';
import { frettedScoreLayout, FrettedFullScore } from '../dist/fretted-score.mjs';

test('stopping snapshots only reached notes, closes the last timing window and preserves the live judge',()=>{
  const judge=new Judge(createChart('rock',80,4));judge.strike('kick',0.01);judge.strike('snare',0.2);
  const snapshot=stoppedJudge(judge,0.8),report=makeRunReport(snapshot,{stopped:true,elapsed:0.8});
  assert.ok(snapshot.chart.notes.length<judge.chart.notes.length);assert.ok(snapshot.chart.notes.every(n=>n.time<=0.8));assert.equal(snapshot.summary().pending,0);assert.ok(judge.summary().pending>0);assert.equal(snapshot.summary().hits,1);assert.equal(snapshot.extras.length,1);
  const intro=new Judge({...createChart('rock',80,4),notes:[{drum:'kick',time:3,bar:2,beat:1,status:'pending'}]});assert.equal(stoppedJudge(intro,1).chart.notes.length,0);assert.equal(intro.summary().misses,0);
  assert.equal(validateRunReport(report).stopped,true);
  assert.throws(()=>validateRunReport({...report,elapsed:0.1}),/future notes/);
  assert.throws(()=>validateRunReport({...report,notes:report.notes.map((n,i)=>i?n:[...n.slice(0,4),'hit',999,...n.slice(6)])}),/detail/);
});
test('pitch reports retain wrong-note detail and section selection resolves source bars across repeated passes',()=>{
  const source=builtinArrangement().parts[1].chart,chart=createPracticeChart(source,{enabled:true,startBar:3,endBar:4,repeats:4,focus:'all'}),judge=new PitchJudge(chart);
  judge.strike(chart.notes[0].pitch+1,0);judge.advance(Infinity);
  const report=makeRunReport(judge,{instrument:'keyboard'});assert.equal(validateRunReport(report).notes[0][4],'wrong');
  const thirdPass=report.measures.filter(m=>m[3]===3);assert.deepEqual(reportSelection(report,thirdPass[0][0]+0.2,thirdPass.at(-1)[1]-0.2),{startBar:3,endBar:4});
  assert.deepEqual(chart.notes.slice(0,8).map(n=>n.pitch),source.notes.filter(n=>n.bar===3||n.bar===4).map(n=>n.pitch));
  assert.equal(backingSegments(chart,{offset:0.5,buffer:{duration:60}}).length,4);
});
test('lane ordering starts with hi-hat, supports every drum once and leaves notation identities unchanged',()=>{
  const chart=createChart('rock',80,4);assert.deepEqual(orderedDrums(chart).map(d=>d.id),['hihat','kick','snare']);
  const custom=[...DEFAULT_LANE_ORDER].reverse();assert.deepEqual(drumLaneOrder(custom),custom);assert.deepEqual(drumLaneOrder(['hihat','hihat']),DEFAULT_LANE_ORDER);assert.equal(chart.notes[0].drum,'kick');
});
test('full guitar and bass sheets wrap every measure and note once at wide and narrow widths',()=>{
  for(const instrument of ['guitar','bass'])for(const width of [300,1100]){
    const chart=builtinArrangement('band-first').parts.find(p=>p.instrument===instrument).chart,layout=frettedScoreLayout(chart,width),cells=layout.rows.flatMap(row=>row.cells);
    assert.equal(cells.length,chart.bars);assert.equal(cells.flatMap(cell=>cell.notes).length,chart.notes.length);assert.ok(layout.rows.length>=2);
    for(const cell of cells){assert.ok(Number.isFinite(cell.left));assert.ok(cell.width>0);assert.ok(cell.left+cell.width<=width+1);}
  }
});

test('full tablature keeps canvas size bounded while following and reviewing later rows',()=>{
 const context=new Proxy({},{get:()=>()=>{}}),canvas={width:0,height:0,style:{},getContext:()=>context,setAttribute:()=>{}},container={clientWidth:400,clientHeight:260,scrollTop:0},page={style:{}},view=new FrettedFullScore(container,page,canvas),chart=builtinArrangement('band-first').parts.find(p=>p.instrument==='guitar').chart;
 view.draw(chart,0,true);assert.ok(canvas.width<=800);assert.ok(canvas.height<=520);assert.equal(container.scrollTop,0);
 view.draw(chart,chart.duration-0.1,true);assert.ok(container.scrollTop>0);assert.ok(parseFloat(page.style.height)>container.clientHeight);
 container.scrollTop=0;view.draw(chart,chart.duration-0.1,false);assert.equal(container.scrollTop,0);assert.equal(canvas.height,260);
});
