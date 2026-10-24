import test from 'node:test';
import assert from 'node:assert/strict';
import { backingChoices, validateBackingTracks, withBacking } from '../dist/backing-tracks.mjs';
import { importedArrangement } from '../dist/arrangements.mjs';
import { parseMidiSong } from '../dist/midi.mjs';
import { duetMidi } from './duet-fixture.mjs';

const tracks=[{id:'synth',label:'MIDI aligned',audioName:'synth.wav',audioBytes:100,offset:0,timeScale:1,volume:.5},{id:'live',label:'Live backing',audioName:'live.wav',audioBytes:200,offset:-2,timeScale:1.2,volume:.7,audioStart:2,audioEnd:10}];
test('backing selection keeps the song identity and independently retimes all notes and word cues',()=>{
 const song=parseMidiSong(duetMidi(),'duet.mid'),meta={id:'school-song',title:'Original music',parts:[{id:'vocals',name:'Vocals',instrument:'vocals',selected:['1:0']}],selected:[],mapping:{},offset:0,timeScale:1,volume:.5,backingTracks:tracks,defaultBackingId:'synth',lyricsClock:'midi',lyricsText:'WEBVTT\n\n00:00:00.100 --> 00:00:00.900\n<00:00:00.100>Sing <00:00:00.500>along\n'};
 const first=importedArrangement(song,withBacking(meta)),second=importedArrangement(song,withBacking(meta,'live'));
 assert.equal(withBacking(meta,'live').id,'school-song');assert.equal(withBacking(meta,'live').offset,-2);
 assert.equal(second.parts[0].chart.notes[1].time,first.parts[0].chart.notes[1].time*1.2);
 assert.equal(second.parts[0].chart.lyrics[0].words[1].time,.6);assert.equal(meta.offset,0);
 assert.throws(()=>withBacking(meta,'missing'));
});
test('recording-clock lyric and word times retain their reference when switching backing',()=>{
 const meta={offset:-2,timeScale:1.2,defaultBackingId:'live',backingTracks:tracks,lyricsClock:'recording',lyricsText:'[00:02.600]Original words'};
 const song=parseMidiSong(duetMidi(),'duet.mid'),parts=[{id:'vocals',name:'Vocals',instrument:'vocals',selected:['1:0']}];
 const selected=withBacking({...meta,parts},'synth');
 assert.equal(withBacking(meta,null).backingId,'live');
 assert.ok(Math.abs(importedArrangement(song,selected).parts[0].chart.lyrics[0].time-.5)<1e-9);
});
test('backings validate identifiers, defaults, sizes, ranges and independent settings',()=>{
 assert.equal(validateBackingTracks(tracks,'synth').length,2);
 assert.throws(()=>validateBackingTracks([...tracks,tracks[0]],'synth'));
 assert.throws(()=>validateBackingTracks(tracks,'missing'));
 assert.throws(()=>validateBackingTracks([{...tracks[0],id:'../outside'}],'../outside'));
 assert.throws(()=>validateBackingTracks([{...tracks[0],audioStart:5,audioEnd:4}],'synth'));
 assert.deepEqual(validateBackingTracks([],null),[]);
 assert.equal(backingChoices({audioName:'legacy.wav',offset:-1,timeScale:1.1,volume:.4})[0].offset,-1);
});
