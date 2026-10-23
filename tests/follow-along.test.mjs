import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMidiSong} from '../dist/midi.mjs';
import {importedArrangement,builtinArrangement,partSummary} from '../dist/arrangements.mjs';
import {frettedChart,FollowCursor,STRING_TUNINGS} from '../dist/follow-along.mjs';
import {parseLyricText,midiLyricCues,arrangementLyrics,currentLyric} from '../dist/lyrics.mjs';
import {drawFretted} from '../dist/follow-view.mjs';
import {ensembleMidi} from './ensemble-fixture.mjs';

test('MIDI identifies each instrument and retains lyric timing across tempo changes without treating ordinary text as lyrics',()=>{
 const song=parseMidiSong(ensembleMidi());assert.equal(song.parts.find(part=>part.name==='Guitar').guitarCandidate,true);assert.equal(song.parts.find(part=>part.name==='Bass').bassCandidate,true);
 assert.deepEqual(midiLyricCues(song).map(cue=>cue.text),['Find the beat','Play together']);assert.equal(midiLyricCues(song)[1].time,3);
 assert.deepEqual(midiLyricCues(parseMidiSong(ensembleMidi({karaoke:true}))),midiLyricCues(song));assert.equal(midiLyricCues(parseMidiSong(ensembleMidi({lyrics:false}))).length,0);
 const arrangement=importedArrangement(song,{timeScale:1.25});assert.deepEqual(arrangement.parts.map(p=>p.instrument),['drums','keyboard','guitar','bass','vocals']);
 for(const part of arrangement.parts)assert.equal(part.chart.duration,arrangement.duration);
 assert.equal(arrangement.parts[4].chart.lyrics[1].time,3.75);assert.equal(arrangement.parts[2].chart.notes[0].pitch,40);
 const piano=song.parts.find(part=>part.keyboardCandidate);assert.deepEqual(importedArrangement({...song,parts:[piano],selected:[piano.id]}).parts.map(p=>p.instrument),['keyboard','vocals']);
 const explicit=importedArrangement(song,{parts:[{id:'drums',name:'Drums',instrument:'drums',selected:song.selected}]});assert.equal(explicit.parts.length,1);
});
test('guitar and bass fingering preserves pitch and handles chords, open strings and out-of-range notes explicitly',()=>{
 const notes=[40,47,52,55,59,64,100].map((pitch,i)=>({id:String(i),pitch,time:0,duration:1}));
 const chart=frettedChart({notes},'guitar'),placed=chart.notes.filter(n=>n.string!==null);assert.equal(placed.length,6);assert.equal(new Set(placed.map(n=>n.string)).size,6);assert.equal(chart.unmapped,1);
 for(const note of placed)assert.equal(STRING_TUNINGS.guitar[note.string]+note.fret,note.pitch);
 const bass=frettedChart({notes:[{pitch:28,time:0},{pitch:27,time:1}]},'bass');assert.equal(bass.notes[0].fret,0);assert.equal(bass.notes[0].string,3);assert.equal(bass.notes[1].string,null);
 assert.equal(notes[0].string,undefined);
});
test('timed lyric imports support LRC, VTT and SRT, recording offsets, explicit end gaps and text-only payloads',()=>{
 const lrc=parseLyricText('[00:01.50][00:03.00]Original words\n[00:05.00]Next line');assert.equal(lrc.length,3);
 const vtt=parseLyricText('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<b>Original words</b>\n\n00:00:04.000 --> 00:00:05.000\nNext line');assert.equal(vtt[0].text,'Original words');
 assert.equal(parseLyricText('1\n00:00:01,000 --> 00:00:02,000\nOriginal words')[0].end,2);
 const song=parseMidiSong(ensembleMidi()),cues=arrangementLyrics(song,{lyricsText:'[00:03.00]Line',lyricsClock:'recording',offset:-1,timeScale:2,lyricsOffset:0.25});assert.equal(cues[0].time,2.25);
 assert.equal(arrangementLyrics(song,{lyricsText:'[00:03.00]Line',timeScale:2})[0].time,6);
 assert.equal(currentLyric(vtt,2.5).current,null);assert.equal(currentLyric(vtt,1.5).current.text,'Original words');
 for(const input of ['Untimed lyrics','[00:90.00]Bad time','WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nBad'])assert.throws(()=>parseLyricText(input));
 assert.throws(()=>parseLyricText('x'.repeat(10001)),/10 KB/);
});
test('follow cursor and provided full band never invent scored hits or misses',()=>{
 const arrangement=builtinArrangement('band-first');assert.equal(arrangement.parts.length,5);
 for(const part of arrangement.parts.slice(2)){const cursor=new FollowCursor(part.chart);cursor.advance(Infinity);assert.deepEqual(partSummary(cursor),{mode:'follow'});assert.equal(cursor.summary().accuracy,undefined);}
 assert.ok(arrangement.parts[4].chart.lyrics.every(cue=>cue.end>cue.time));
});
test('string highway and tab render bounded geometry and visible fret numbers for both instruments',()=>{
 const context=new Proxy({},{get:(_obj,key)=>key==='fillText'?(...args)=>{assert.ok(args.every(value=>typeof value!=='number'||Number.isFinite(value)));}:()=>{}});
 for(const instrument of ['guitar','bass'])for(const tab of [true,false])for(const time of [-1,0,3,20])drawFretted(context,900,390,builtinArrangement('band-first').parts.find(p=>p.instrument===instrument).chart,time,tab);
});
