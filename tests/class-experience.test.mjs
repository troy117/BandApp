import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSeatPart, classMeter, classMeterMarkup } from '../dist/class-experience.mjs';
import { checkedLiveVoice } from '../server/band-sessions.mjs';

test('student defaults select a matching available part with an honest fallback', () => {
  const song = { parts: [{id:'kit',instrument:'drums'}, {id:'lead',instrument:'vocals'}, {id:'keys',instrument:'keyboard'}] };
  assert.equal(defaultSeatPart(song,{defaultInstrument:'vocals'}).id,'lead'); assert.equal(defaultSeatPart(song,{defaultInstrument:'keyboard'}).id,'keys');
  assert.equal(defaultSeatPart(song,{defaultInstrument:'bass'},2).id,'keys'); assert.equal(defaultSeatPart(undefined,{}),undefined);
});
test('class meters show judged performance and keep live vocal pitch separate from grading', () => {
  const person = { name:'<Singer>',instrument:'drums',state:'playing',connected:true,progress:{hits:8,misses:1,wrong:0,extras:1,bestStreak:5,position:3} };
  assert.equal(classMeter(person,10).accuracy,80); assert.equal(classMeter(person,10).progress,30);
  const vocal = {...person,instrument:'vocals',progress:{position:3,voice:{state:'on-pitch',cents:3}}};
  assert.equal(classMeter(vocal,10).accuracy,null); assert.equal(classMeter(vocal,10).label,'On pitch');
  assert.match(classMeterMarkup(vocal,10),/&lt;Singer&gt;/); assert.match(classMeterMarkup(vocal,10),/Unscored/);
  assert.equal(classMeter({...vocal,connected:false},10).voice,null); assert.equal(classMeter({...vocal,state:'completed'},10).label,'Completed');
});
test('live pitch guidance accepts only bounded vocal states and strips arbitrary payloads', () => {
  assert.deepEqual(checkedLiveVoice({state:'low',cents:-35.1,audio:'ignored'},'vocals'),{state:'low',cents:-35});
  assert.deepEqual(checkedLiveVoice({state:'off',cents:null},'vocals'),{state:'off',cents:null});
  assert.equal(checkedLiveVoice(undefined,'guitar'),null);
  for (const voice of [{state:'on-pitch',cents:80},{state:'quiet',cents:4},{state:'high',cents:Infinity},{state:'unknown',cents:null}]) assert.throws(()=>checkedLiveVoice(voice,'vocals'));
  assert.throws(()=>checkedLiveVoice({state:'on-pitch',cents:0},'guitar'));
});
