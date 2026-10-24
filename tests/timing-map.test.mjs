import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTimingMap,timingFunctions} from '../dist/timing-map.mjs';
import {alignMidiChart,midiPositionTime,waveformNotes} from '../dist/sync.mjs';
import {withBacking} from '../dist/backing-tracks.mjs';
import {parseMidiSong,midiTimeGrid} from '../dist/midi.mjs';
import {duetMidi} from './duet-fixture.mjs';
import {importedArrangement} from '../dist/arrangements.mjs';
import {arrangementFromBar} from '../dist/session-transport.mjs';
import {backingSegments,createPracticeChart} from '../dist/practice.mjs';
import {ClassroomStore} from '../server/classroom.mjs';

const map={version:1,source:'Synthetic changing tempo',points:[[0,2],[1,3],[2,4.5],[4,6.5]]};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('piecewise timing is invertible at anchors, between anchors and through endpoint holds',()=>{
 const timing=timingFunctions({timingMap:map});
 for(const t of [0,.2,1,1.4,2,3,4,4.5])near(timing.inverse(timing.forward(t)),t);
 assert.equal(timing.origin,2);assert.equal(timing.forward(1.5),1.75);
 for(const points of [[[.1,0],[2,2]],[[0,0],[1,1],[.9,2]],[[0,0],[1,0]],[[0,0],[1,11]]])assert.throws(()=>validateTimingMap({version:1,points}));
});
test('all instrument notes, releases, beats, measures, tempo and count-in use one mapped clock',()=>{
 const song=parseMidiSong(duetMidi(),'original.mid'),base={...midiTimeGrid(song),duration:4,bars:2,beats:Array.from({length:8},(_,i)=>({time:i*.5,quarter:i,bar:Math.floor(i/4)+1,beat:i%4+1})),measures:[{bar:1,time:0,endTime:2,startQuarter:0,endQuarter:4,numerator:4,denominator:4},{bar:2,time:2,endTime:4,startQuarter:4,endQuarter:8,numerator:4,denominator:4}]},mapped=alignMidiChart({...base,notes:[{time:.5,duration:1,pitch:60}]},1,map);
 near(mapped.notes[0].duration,1.25);near(mapped.beats[3].time,1.75);near(mapped.duration,4.5);
 near(midiPositionTime(mapped,1,4),1.75);near(mapped.countInBeatSeconds,.5);near(mapped.tempos.find(t=>t.quarter===2).bpm,80);
 const hits=waveformNotes({notes:[{time:1.5}]},{offset:-2,timeScale:1,timingMap:map},{start:0,duration:10,left:0,width:100});near(hits[0].audioTime,3.75);
 assert.throws(()=>alignMidiChart(base,1,{version:1,points:[[0,0],[1,1]]}));
});
test('a mapped backing retains Songsterr notes and transfers word cues and imported vocal guides',()=>{
 const song=parseMidiSong(duetMidi(),'original.mid');song.duration=4;song.endTick=3840;
 const tracks=[{id:'synth',label:'Synth',audioName:'synth.wav',audioBytes:4,offset:0,timeScale:1,volume:.5},{id:'original',label:'Original',audioName:'original.wav',audioBytes:5,offset:-2,timeScale:1,volume:.5,timingMap:map}];
 const meta={id:'same-song',title:'Original',parts:[{id:'drums',name:'Drums',instrument:'drums',selected:['0:9']},{id:'vocals',name:'Vocals',instrument:'vocals',selected:[]}],selected:['0:9'],mapping:{},backingTracks:tracks,defaultBackingId:'synth',offset:0,timeScale:1,volume:.5,lyricsClock:'midi',lyricsText:'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nSing <00:00:01.500>along\n',vocalNotes:[{time:1,duration:1,pitch:60,velocity:.7}]};
 const source=importedArrangement(song,withBacking(meta,'synth')),changed=importedArrangement(song,withBacking(meta,'original'));
 assert.equal(source.parts[0].chart.duration,4);assert.equal(source.parts[1].chart.notes[0].duration,1);
 assert.equal(changed.parts[0].chart.duration,4.5);assert.equal(changed.parts[1].chart.notes[0].duration,1.5);assert.equal(changed.parts[1].chart.lyrics[0].words[1].time,1.75);
 assert.equal(withBacking(withBacking(meta,'original'),'synth').timingMap,null);
 const chart=createPracticeChart(changed.parts[0].chart,{enabled:true,startBar:2,endBar:2,repeats:2},{allowEmpty:true});
 const clips=backingSegments(chart,{buffer:{duration:10},offset:-2});near(clips[0].offset,4.5);near(clips[1].when,2);
 const sliced=arrangementFromBar(changed,2).parts[1].chart;near(sliced.lyrics[0].words.at(-1).time,0);near(sliced.lyrics[0].end,1);
});
test('published metadata retains independent maps and vocal notes and rejects invalid guides',()=>{
 const input={title:'Original',fileName:'original.mid',midiBytes:100,audioBytes:4,audioName:'original.wav',selected:['0:9'],mapping:{},offset:-2,timeScale:1,volume:.5,backingTracks:[{id:'original',label:'Original',audioName:'original.wav',audioBytes:4,offset:-2,timeScale:1,volume:.5,timingMap:map}],defaultBackingId:'original',vocalNotes:[{time:.1,duration:.5,pitch:60}]};
 const meta=ClassroomStore.prototype.metadata(input);assert.deepEqual(meta.backingTracks[0].timingMap,map);assert.equal(meta.vocalNotes[0].pitch,60);
 assert.throws(()=>ClassroomStore.prototype.metadata({...input,vocalNotes:[{time:1,duration:-1,pitch:60}]}));
});

test('recording-specific word timing survives selection and publishing without replacing the base lyrics',()=>{
 const base='[00:00.100]Base words',recording='[00:00.200]Recording words';
 const tracks=[{id:'synth',label:'Synth',audioName:'synth.wav',audioBytes:4,offset:0,timeScale:1,volume:.5},{id:'original',label:'Original',audioName:'original.wav',audioBytes:5,offset:-2,timeScale:1,volume:.5,timingMap:map,lyricsText:recording}];
 const meta={title:'Original',fileName:'original.mid',midiBytes:100,audioBytes:4,audioName:'synth.wav',selected:['0:9'],mapping:{},offset:0,timeScale:1,volume:.5,backingTracks:tracks,defaultBackingId:'synth',lyricsText:base,lyricsClock:'midi',lyricsOffset:0};
 const selected=withBacking(meta,'original');assert.equal(selected.lyricsText,recording);
 assert.equal(withBacking(selected,'synth').lyricsText,base);
 const published=ClassroomStore.prototype.metadata({...meta,defaultBackingId:'original'});
 assert.equal(published.lyricsText,base);assert.equal(published.baseLyrics,undefined);
 assert.equal(withBacking(published,'original').lyricsText,recording);
 assert.equal(withBacking(published,'synth').lyricsText,base);
 const noBase=ClassroomStore.prototype.metadata({...meta,lyricsText:undefined,lyricsClock:undefined,lyricsOffset:undefined,defaultBackingId:'original'});
 assert.equal(noBase.lyricsText,undefined);assert.equal(withBacking(withBacking(noBase,'original'),'synth').lyricsText,undefined);
});
