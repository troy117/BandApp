import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardNotation, keyboardRhythm, keyboardQuarterAt, keyboardScoreLayout, KeyboardFullScore } from '../dist/keyboard-score.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';

test('piano grand staff preserves chords, bass notes, cross-bar holds and silent measures without changing MIDI',()=>{
 const chart=builtinArrangement().parts[1].chart;
 chart.notes=[{id:'low',pitch:48,time:0,duration:6,quarter:0,bar:1,beat:1},{id:'c',pitch:60,time:0,duration:.75,quarter:0,bar:1,beat:1},{id:'e',pitch:64,time:0,duration:.75,quarter:0,bar:1,beat:1}];
 const before=JSON.stringify(chart),model=keyboardNotation(chart),first=model.measures[0],second=model.measures[1];
 assert.equal(first.groups.find(g=>g.staff==='treble').notes.length,2);assert.equal(first.groups.find(g=>g.staff==='bass').notes[0].tieOut,true);
 assert.equal(second.groups.find(g=>g.staff==='bass').notes[0].tieIn,true);assert.ok(model.measures[2].rests.some(r=>r.full));assert.equal(JSON.stringify(chart),before);
});
test('piano rhythm flags distinguish dotted sixteenths, eighth triplets, quarter triplets and half notes',()=>{
 assert.equal(keyboardRhythm(.375).flags,2);assert.equal(keyboardRhythm(.375).dotted,true);
 assert.equal(keyboardRhythm(1/3).flags,1);assert.equal(keyboardRhythm(1/3).triplet,true);assert.equal(keyboardRhythm(2/3).flags,0);assert.equal(keyboardRhythm(2).hollow,true);
});
test('score cursor follows the exact tempo map and layouts keep every measure at phone and desktop widths',()=>{
 const points=[{time:0,quarter:0},{time:2,quarter:4},{time:6,quarter:8}];assert.equal(keyboardQuarterAt(points,1),2);assert.equal(keyboardQuarterAt(points,4),6);
 const model=keyboardNotation(builtinArrangement().parts[1].chart);
 for(const width of [320,390,844,1600])for(const zoom of [.85,1,1.5]){const layout=keyboardScoreLayout(model,width,zoom);assert.equal(layout.rows.flatMap(r=>r.cells).length,model.measures.length);assert.ok(layout.rows.every(r=>r.cells.every(c=>c.width>0&&Number.isFinite(c.left)&&c.left+c.width<=width)));}
});
test('long piano scores use a viewport-sized canvas and follow later rows with finite geometry',()=>{
 const chart=builtinArrangement('duet-long').parts[1].chart;
 const ctx=new Proxy({}, {get:()=> (...args)=>assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v)))});
 const container={clientWidth:390,clientHeight:350,scrollTop:0,dataset:{}},page={style:{}},canvas={style:{},getContext:()=>ctx,setAttribute(){}};
 const score=new KeyboardFullScore(container,page,canvas);score.draw(chart,0,false);score.draw(chart,chart.duration-1,true);
 assert.ok(container.scrollTop>0);assert.ok(Number(container.dataset.activeRow)>1);assert.ok(canvas.height<=700);assert.ok(parseFloat(page.style.height)>canvas.height);
});
