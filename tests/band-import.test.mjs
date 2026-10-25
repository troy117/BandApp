import test from 'node:test';
import assert from 'node:assert/strict';
import { BandImport } from '../dist/band-import.mjs';
import { SongImporter, filterLibrarySongs } from '../dist/song-import.mjs';
import { duetMidi } from './duet-fixture.mjs';

function fields() {
  const nodes = new Map();
  return id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: false, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, querySelectorAll() { return []; }, setAttribute(name,value) { this[name]=value; }, scrollIntoView() {}, close() {} });
    return nodes.get(id);
  };
}

test('song library combines search, part and visibility filters and sorts without mutating source songs', () => {
  const songs = [{ id: 'a', title: 'Song 10', fileName: 'voice.mid', duration: 90, savedAt: 100, parts: [{ instrument: 'vocals' }], visibility: 'teachers' }, { id: 'b', title: 'Song 2', duration: 40, savedAt: 200, parts: [{ instrument: 'keyboard' }, { instrument: 'vocals' }] }, { id: 'c', title: 'Drum song', duration: 20, savedAt: 300 }], before = structuredClone(songs);
  assert.deepEqual(filterLibrarySongs(songs).map(song => song.id), ['c', 'b', 'a']);
  assert.deepEqual(filterLibrarySongs(songs, { query: ' VOICE ', instrument: 'vocals', visibility: 'teachers' }).map(song => song.id), ['a']);
  assert.deepEqual(filterLibrarySongs(songs, { instrument: 'vocals', visibility: 'school' }).map(song => song.id), ['b']);
  assert.deepEqual(filterLibrarySongs(songs, { instrument: 'drums' }).map(song => song.id), ['c']);
  assert.deepEqual(filterLibrarySongs(songs, { sort: 'recent' }).map(song => song.id), ['c', 'b', 'a']);
  assert.deepEqual(filterLibrarySongs(songs, { sort: 'duration' }).map(song => song.id), ['c', 'b', 'a']);
  assert.deepEqual(songs, before);
});

test('compact song rows keep one practice action, student defaults, escaped titles and teacher-only access controls', () => {
  const el = fields(), importer = Object.assign(Object.create(SongImporter.prototype), { el, libraryScope: 'school', school: { staff: true, user: { defaultInstrument: 'vocals' } }, librarySongs: [{ id: 'song', title: 'A <song>', duration: 120, bytes: 100, canManage: true, visibility: 'teachers', parts: [{ instrument: 'drums' }, { instrument: 'vocals' }] }] });
  importer.resetLibraryFilters(); importer.renderLibraryRows(); const html = el('library-list').innerHTML;
  assert.match(html, /A &lt;song&gt;/); assert.equal((html.match(/data-action="practice"/g) || []).length, 1);
  assert.match(html, /value="vocals" selected/); assert.match(html, /data-visibility-song/); assert.match(html, /data-action="parts"/); assert.match(html, /Teachers only/);
  importer.school.staff = false; importer.renderLibraryRows(); assert.doesNotMatch(el('library-list').innerHTML, /data-visibility-song|data-action="archive"|library-manage/);
  importer.school.staff = true; importer.libraryScope = 'device'; importer.renderLibraryRows();
  assert.doesNotMatch(el('library-list').innerHTML, /data-label="Student access"/); assert.match(el('library-list').innerHTML, /Publish teachers only/);
});

test('editing an existing library song retains backing, drum overrides and alignment and publishes a revision of that song', async () => {
  const q=fields(),bytes=duetMidi().buffer,audioBytes=new Uint8Array([1,2,3]).buffer,buffer={duration:4},requests=[];
  const meta={id:'song-a',revisionId:'version-a',canManage:true,title:'Original duet',fileName:'duet.mid',audioName:'backing.wav',mapping:{36:'tom3',42:'ignore'},offset:-0.125,timeScale:1.25,volume:0.37,parts:[{id:'drums',instrument:'drums',name:'Drums',selected:['0:9']},{id:'keyboard',instrument:'keyboard',name:'Piano',selected:['1:0']}]};
  const school={staff:true,download:async route=>route.endsWith('/midi')?bytes:audioBytes,request:async(route,options)=>{
    requests.push({route,options});
    if(route==='/library/song-a')return {song:meta};
    if(route==='/library/uploads')return {uploadId:'upload-a'};
    if(route.endsWith('/publish'))return {song:{...meta,revisionId:'version-b'}};
    return {uploaded:true};
  }};
  const loaded=[];
  const practice={q,school,rooms:{room:null},stop(){},audio:{decodeBacking:async()=>buffer},refreshCatalog:async()=>{},loadChoice:async id=>loaded.push(id)};
  const importer=new BandImport(practice);await importer.editSchoolSong(meta.id);
  assert.equal(importer.draft.buffer,buffer);assert.equal(importer.draft.audioBytes,audioBytes);
  assert.match(q('b-import-tracks').innerHTML,/value="keyboard" selected/);assert.equal(q('b-import-speed').value,80);assert.equal(q('b-import-offset').value,-0.125);assert.equal(q('b-import-volume').value,37);
  q('b-import-tracks').querySelectorAll=()=>[{value:'drums',dataset:{bandTrack:'0:9'}},{value:'keyboard',dataset:{bandTrack:'1:0'}}];
  await importer.publish();
  const upload=requests.find(item=>item.route==='/library/uploads').options.data;
  assert.equal(upload.songId,'song-a');assert.equal(upload.revisionId,'version-a');assert.equal(upload.audioName,'backing.wav');
  assert.deepEqual(upload.mapping,meta.mapping);assert.equal(upload.offset,meta.offset);assert.equal(upload.timeScale,meta.timeScale);assert.equal(upload.volume,meta.volume);
  assert.deepEqual(loaded,['school:song-a']);assert.equal(importer.draft.schoolSource.revisionId,'version-b');
  q('b-midi-file').files=[{name:'fresh.mid',size:bytes.byteLength,arrayBuffer:async()=>bytes}];await importer.readMidi();
  assert.equal(importer.draft.schoolSource,undefined);assert.equal(q('b-import-offset').value,0);assert.equal(q('b-publish').textContent,'Publish new school song');
  importer.reset();assert.equal(q('b-publish').disabled,true);assert.equal(q('b-audio-file').disabled,true);assert.equal(q('b-midi-file').disabled,false);
});

test('library practice and part editing never fall through to archiving a song', async t => {
  const q=fields(),previousDocument=globalThis.document,previousWindow=globalThis.window,events=[],actions=[];
  globalThis.document={getElementById:q,addEventListener(){}};globalThis.window={dispatchEvent:event=>events.push(event.type),addEventListener(){}};
  t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
  const importer=new SongImporter({},()=>{});importer.libraryScope='school';
  importer.loadSchoolSong=id=>actions.push('load:'+id);importer.archiveSong=id=>actions.push('archive:'+id);
  for(const action of ['load','keyboard','parts','audio'])q('library-list').listeners.click({target:{closest:()=>({dataset:{action,song:'song-a'}})}});
  assert.deepEqual(actions,['load:song-a']);assert.deepEqual(events,['band-load-school','band-edit-school','band-edit-school']);
  q('library-list').listeners.click({target:{closest:()=>({dataset:{action:'archive',song:'song-a'}})}});
  assert.deepEqual(actions,['load:song-a','archive:song-a']);
});

test('reopening explicit instrument assignments keeps ignored tracks ignored despite MIDI suggestions', () => {
  const fields = {}, importer = Object.assign(Object.create(BandImport.prototype), {
    timing: {reset() {}}, q: id => fields[id] ||= {},
    draft: {song: {title:'Original ensemble',lyricEvents:[],parts:[
      {id:'0:9',name:'Drums',track:1,channel:10,drumCandidate:true,notes:[{}]},
      {id:'1:0',name:'Bass',track:2,channel:1,bassCandidate:true,notes:[{}]},
      {id:'2:0',name:'Brass with a reused MIDI program channel',track:3,channel:1,bassCandidate:true,notes:[{}]},
      {id:'3:1',name:'Ignored guitar',track:4,channel:2,guitarCandidate:true,notes:[{}]},
    ]}},
  });
  importer.renderDraft({parts:[{instrument:'drums',selected:['0:9']},{instrument:'bass',selected:['1:0']}]});
  const html = fields['b-import-tracks'].innerHTML;
  const options = id => html.match(new RegExp('<select data-band-track="'+id+'">([\\s\\S]*?)</select>'))[1];
  assert.match(options('0:9'), /value="drums" selected/);
  assert.match(options('1:0'), /value="bass" selected/);
  assert.doesNotMatch(options('2:0'), / selected/);
  assert.doesNotMatch(options('3:1'), / selected/);
  importer.renderDraft();
  assert.match(fields['b-import-tracks'].innerHTML, /value="bass" selected/);
});

test('replacing a school backing preserves MIDI, all parts and word-timed lyrics in the same song revision', async () => {
  const q=fields(),bytes=duetMidi().buffer,oldAudio=new Uint8Array([1,2,3]).buffer,newAudio=new Uint8Array([4,5,6,7]).buffer,requests=[];
  const lyrics='WEBVTT\n\n00:00:00.100 --> 00:00:00.900\n<00:00:00.100>Sing<00:00:00.500> <00:00:00.500>along\n';
  const parts=[{id:'drums',name:'Drums',instrument:'drums',selected:['0:9']},{id:'keyboard',name:'Piano / Keyboard',instrument:'keyboard',selected:['1:0']},{id:'vocals',name:'Vocals',instrument:'vocals',selected:[]}];
  const meta={id:'same-song',revisionId:'before',canManage:true,title:'Original music',fileName:'duet.mid',audioName:'old.wav',parts,mapping:{36:'tom3'},offset:0,timeScale:1,volume:.65,lyricsText:lyrics,lyricsClock:'midi',lyricsOffset:0};
  const school={staff:true,download:async route=>route.endsWith('/midi')?bytes:oldAudio,request:async(route,options)=>{requests.push({route,options});if(route==='/library/same-song')return {song:meta};if(route==='/library/uploads')return {uploadId:'update'};if(route.endsWith('/publish'))return {song:{...meta,revisionId:'after'}};return {};}};
  const practice={q,school,rooms:{room:null},stop(){},audio:{decodeBacking:async data=>({duration:data.byteLength===3?8:9})},refreshCatalog:async()=>{},loadChoice:async()=>{}};
  const importer=new BandImport(practice);await importer.editSchoolSong('same-song');
  const rows=[{value:'drums',dataset:{bandTrack:'0:9'}},{value:'keyboard',dataset:{bandTrack:'1:0'}}];q('b-import-tracks').querySelectorAll=()=>rows;
  q('b-audio-file').files=[{name:'replacement.mp3',size:newAudio.byteLength,arrayBuffer:async()=>newAudio}];await importer.readAudio();
  importer.backing.sync.set({offset:-.25,timeScale:1.05});q('b-import-volume').value=37;
  await importer.publish();
  const upload=requests.find(item=>item.route==='/library/uploads').options.data;
  assert.equal(upload.songId,'same-song');assert.equal(upload.revisionId,'before');assert.equal(upload.audioName,'replacement.mp3');
  assert.equal(upload.offset,-.25);assert.ok(Math.abs(upload.timeScale-1.05)<.00001);assert.equal(upload.volume,.37);
  assert.deepEqual(upload.parts,parts);assert.equal(upload.lyricsText,lyrics);assert.equal(upload.lyricsClock,'midi');assert.equal(upload.lyricsOffset,0);
  assert.deepEqual(requests.find(item=>item.route.endsWith('/midi')).options.data,bytes);
  assert.deepEqual(requests.find(item=>item.route.endsWith('/audio-main')).options.data,newAudio);
  assert.equal(importer.draft.schoolSource.revisionId,'after');
});
