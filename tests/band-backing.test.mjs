import test from 'node:test';
import assert from 'node:assert/strict';
import { backingReferences } from '../dist/band-backing.mjs';
import { AudioSync, syncLanes } from '../dist/audio-sync.mjs';
import { parseMidiSong } from '../dist/midi.mjs';
import { duetMidi } from './duet-fixture.mjs';

const song=()=>parseMidiSong(duetMidi(),'original.mid');
test('backing comparison follows assigned parts, supports pitched-only songs and ignores lyric-only parts', () => {
  const midi=song(),before=JSON.stringify(midi);
  const parts=backingReferences(midi,[{id:'0:9',instrument:'drums'},{id:'1:0',instrument:'keyboard'}],{36:'tom3'});
  assert.deepEqual(parts.map(p=>p.id),['drums','keyboard']);assert.equal(parts[0].chart.notes[0].drum,'tom3');
  const melody=backingReferences(midi,[{id:'1:0',instrument:'vocals'}]);assert.equal(melody[0].chart.notes[0].pitch,60);
  assert.equal(backingReferences(midi,[]).length,0);assert.deepEqual(syncLanes(melody[0].chart).map(l=>l.id),['notes']);
  assert.equal(JSON.stringify(midi),before);
});

function previewFixture() {
  const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',checked:false,disabled:false});return nodes.get(id);};
  el('sync-bar').value=1;el('sync-beat').value=1;el('sync-audio').value=0;el('sync-guide').checked=true;
  const calls=[],chart=backingReferences(song(),[{id:'1:0',instrument:'keyboard'}])[0].chart;
  const owner={token:1,busy:false,dialog:{open:true},syncChart:()=>chart,draft:{buffer:{duration:10},offset:0,timeScale:1,volume:.4},audio:{context:{currentTime:0},ready:async()=>{},silence(){calls.push('stop');},playBacking(){calls.push('backing');},click(){calls.push('click');}},playSyncNote(note){calls.push(note.pitch);}};
  return {sync:Object.assign(Object.create(AudioSync.prototype),{owner,el}),owner,el,calls};
}
test('previewing a pitched part schedules its guide with the backing and metronome', async t => {
  const {sync,calls}=previewFixture();t.after(()=>sync.stop());await sync.play(true);
  assert.ok(calls.includes('backing'));assert.ok(calls.includes('click'));assert.ok(calls.includes(60));assert.equal(sync.preview,true);
});
test('stopping or closing during audio initialization prevents a late backing preview', async () => {
  for(const close of [false,true]) {
    const {sync,owner,calls}=previewFixture();let ready;owner.audio.ready=()=>new Promise(resolve=>ready=resolve);
    const pending=sync.play(true);if(close)owner.dialog.open=false;else sync.stop();ready();await pending;
    assert.equal(calls.includes('backing'),false);assert.equal(sync.preview,false);
  }
});
test('recording preview honors saved cuts without altering the audio clock',async t=>{
  const {sync,owner}=previewFixture(),played=[];t.after(()=>sync.stop());
  Object.assign(owner.draft,{audioStart:.2,audioEnd:.8});owner.audio.playBacking=(...args)=>played.push(args);
  await sync.play(false);assert.equal(played.length,1);assert.ok(Math.abs(played[0][1]-.28)<1e-8);assert.equal(played[0][2],.2);assert.ok(Math.abs(played[0][4]-.6)<1e-8);
});
test('the waveform draws selectable pitched attacks with finite geometry', () => {
  const {sync,owner,el}=previewFixture();
  const ctx=new Proxy({}, {get:()=> (...args)=>assert.ok(args.every(v=>typeof v!=='number'||Number.isFinite(v)))});
  Object.assign(el('sync-waveform'),{clientWidth:640,style:{},getContext:()=>ctx});el('audio-sync').open=true;el('sync-show-midi').checked=true;el('sync-zoom').value=10;
  Object.assign(owner.draft.buffer,{sampleRate:100,length:1000,getChannelData:()=>new Float32Array(1000)});
  sync.draw();assert.ok(sync.noteTargets.length>0);assert.ok(sync.noteTargets.every(target=>Number.isFinite(target.x)&&Number.isFinite(target.y)));
  assert.match(el('sync-note-selection').textContent,/C4/);
});
