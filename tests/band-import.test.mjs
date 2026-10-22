import test from 'node:test';
import assert from 'node:assert/strict';
import { BandImport } from '../dist/band-import.mjs';
import { SongImporter } from '../dist/song-import.mjs';
import { duetMidi } from './duet-fixture.mjs';

function fields() {
  const nodes = new Map();
  return id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: false, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, scrollIntoView() {}, close() {} });
    return nodes.get(id);
  };
}

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
});

test('library practice and part editing never fall through to archiving a song', async t => {
  const q=fields(),previousDocument=globalThis.document,previousWindow=globalThis.window,events=[],actions=[];
  globalThis.document={getElementById:q,addEventListener(){}};globalThis.window={dispatchEvent:event=>events.push(event.type),addEventListener(){}};
  t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
  const importer=new SongImporter({},()=>{});importer.libraryScope='school';
  importer.loadSchoolSong=id=>actions.push('load:'+id);importer.archiveSong=id=>actions.push('archive:'+id);
  for(const action of ['load','keyboard','parts'])q('library-list').listeners.click({target:{closest:()=>({dataset:{action,song:'song-a'}})}});
  assert.deepEqual(actions,['load:song-a']);assert.deepEqual(events,['band-load-school','band-edit-school']);
  q('library-list').listeners.click({target:{closest:()=>({dataset:{action:'archive',song:'song-a'}})}});
  assert.deepEqual(actions,['load:song-a','archive:song-a']);
});
