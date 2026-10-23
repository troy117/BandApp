import { createChart, Judge } from '../dist/engine.mjs';
import { PitchJudge } from '../dist/instruments.mjs';
import { createPracticeChart } from '../dist/practice.mjs';
import { stoppedJudge, makeRunReport } from '../dist/run-report.mjs';
import { partSummary } from '../dist/arrangements.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { ClassroomStore, ClassroomApi } from '../server/classroom.mjs';
import { createAppServer } from '../scripts/serve.mjs';
import { prepareSchoolStorage } from '../server/storage.mjs';
import { BandSessions } from '../server/band-sessions.mjs';
import { builtinArrangement } from '../dist/arrangements.mjs';
import { duetMidi } from './duet-fixture.mjs';
import { createDemoWav } from '../dist/demo-data.mjs';
import { ensembleMidi } from './ensemble-fixture.mjs';

async function bandFixture(t) {
  const directory=await mkdtemp(path.join(tmpdir(),'groove-band-')),store=await ClassroomStore.open(directory),api=new ClassroomApi(store,{secureCookies:false}),server=createAppServer({school:api}),peers=[];
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;api.options.publicOrigin=origin;
  let now=1000;server.bandSessions.clock=()=>now;
  const setup=await store.setup({username:'teacher',name:'Teacher',schoolName:'Test school',password:'only synthetic test password'});
  const hash=store.user(setup.user.id).password_hash;
  const add=(username,role='student',teacher=setup.user.id)=>{
    const id=randomUUID();store.db.prepare('INSERT INTO users(id,username,name,role,teacher_id,password_hash,created_at) VALUES (?,?,?,?,?,?,?)').run(id,username,username,role,teacher,hash,store.now());return store.makeSession(id);
  };
  const a=add('drummer'),b=add('keys'),other=add('other-teacher','teacher',null),outsider=add('outsider','student',other.user.id);
  const request=async(session,route,method='GET',data,headers={})=>{
    const binary=data instanceof Uint8Array;
    const response=await fetch(origin+'/api'+route,{method,headers:{Origin:origin,Cookie:'groove_session='+session.token,'X-CSRF-Token':session.csrf,...(data!==undefined?{'Content-Type':binary?'application/octet-stream':'application/json'}:{}),...headers},...(data!==undefined?{body:binary?data:JSON.stringify(data)}:{})});
    return {status:response.status,data:await response.json()};
  };
  const wire=async(session,{csrf=session.csrf,requestOrigin=origin}={})=>{
    const socket=new WebSocket(origin.replace('http','ws')+'/api/band/socket',{headers:{Origin:requestOrigin,Cookie:'groove_session='+session.token}}),messages=[],waiters=[];
    socket.on('message',raw=>{const message=JSON.parse(raw);const waiter=waiters.find(w=>w.predicate(message));if(waiter){waiters.splice(waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(message);}else messages.push(message);});
    socket.on('error',()=>{});await once(socket,'open');peers.push(socket);
    const peer={socket,send:message=>socket.send(JSON.stringify(message)),wait:predicate=>{
      const index=messages.findIndex(predicate);if(index>=0)return Promise.resolve(messages.splice(index,1)[0]);
      return new Promise((resolve,reject)=>{const waiter={predicate,resolve,reject,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(new Error('Timed out waiting for a band message'));},2500)};waiters.push(waiter);});
    }};
    peer.send({type:'hello',csrf});await peer.wait(m=>m.type===(csrf===session.csrf?'hello':'error'));return peer;
  };
  t.after(async()=>{
    for(const peer of peers)peer.terminate();server.bandSessions.close();
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});store.close();
    assert.equal(path.dirname(directory),path.resolve(tmpdir()));assert.ok(path.basename(directory).startsWith('groove-band-'));await rm(directory,{recursive:true});
  });
  return {directory,store,api,server,setup,a,b,other,outsider,request,wire,add,advance:value=>{now=value;},now:()=>now};
}
const createRoom=env=>env.request(env.setup,'/band/rooms','POST',{sourceKind:'duet',sourceId:'duet-first',assignments:[{userId:env.a.user.id,partId:'drums'},{userId:env.b.user.id,partId:'keyboard'}]});
async function readyRoom(env,room) {
  const peers=await Promise.all([env.wire(env.setup),env.wire(env.a),env.wire(env.b)]);
  for(const [i,peer] of peers.entries()){peer.send({type:'join',roomId:room.id,clientId:'test-client-'+i});await peer.wait(m=>m.type==='room'&&m.room.id===room.id);}
  for(const peer of peers)peer.send({type:'ready',version:room.version,revisionId:room.arrangement.revisionId,audio:true,input:'Computer keys',sync:{samples:5,rttMs:10,uncertaintyMs:5}});
  const ready=await peers[0].wait(m=>m.type==='room'&&m.room.teacherReady&&m.room.participants.every(p=>p.ready));
  return {peers,room:ready.room};
}
test('teacher-led rooms isolate roster permissions, require readiness and authenticated origin/CSRF',async t=>{
  const env=await bandFixture(t);
  assert.equal((await env.request(env.a,'/band/rooms','POST',{})).status,403);
  assert.equal((await env.request(env.other,'/band/rooms','POST',{sourceKind:'duet',sourceId:'duet-first',assignments:[{userId:env.a.user.id,partId:'drums'},{userId:env.b.user.id,partId:'keyboard'}]})).status,400);
  const created=await createRoom(env);assert.equal(created.status,201);const room=created.data.room;
  await assert.rejects(env.wire(env.a,{requestOrigin:'https://another-school.example'}),/403/);
  assert.equal((await env.request(env.outsider,'/band/rooms/'+room.id)).status,404);
  assert.equal((await env.request(env.a,'/band/rooms/'+room.id+'/start','POST',{version:room.version})).status,403);
  assert.equal((await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:room.version})).status,409);
  const studentView=await env.request(env.a,'/band/rooms/'+room.id);assert.equal(studentView.data.room.participants.length,1);assert.equal(studentView.data.room.participants[0].userId,env.a.user.id);
  const rejected=await env.wire(env.a,{csrf:'wrong-csrf'});await once(rejected.socket,'close');
  const {peers,room:ready}=await readyRoom(env,room);
  const duplicate=await env.wire(env.a);duplicate.send({type:'join',roomId:room.id,clientId:'different-tab'});
  assert.match((await duplicate.wait(m=>m.type==='error')).message,/another tab/);
  duplicate.send({type:'join',roomId:room.id,clientId:'test-client-1'});
  assert.match((await duplicate.wait(m=>m.type==='error')).message,/another tab/);
  const started=await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:ready.version});
  assert.equal(started.status,200);assert.ok(started.data.room.countInAt>=env.now()+2000);
  assert.ok(started.data.room.startAt>started.data.room.countInAt);
  assert.equal((await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:ready.version})).status,409);
  peers[1].send({type:'progress',takeId:'stale-take',position:0,summary:{}});
  assert.match((await peers[1].wait(m=>m.type==='error')).message,/no longer active/);
  const takeId=started.data.room.takeId;
  peers[1].send({type:'unready',version:ready.version,reason:'Old preparation message'});
  assert.match((await peers[1].wait(m=>m.type==='error')).message,/changed/);
  peers[2].send({type:'interrupt',takeId,reason:'Keyboard unplugged.'});
  const interrupted=await peers[0].wait(m=>m.type==='room'&&m.room.participants.some(p=>p.userId===env.b.user.id&&p.state==='interrupted'));
  assert.match(interrupted.room.participants.find(p=>p.userId===env.b.user.id).message,/unplugged/);
  assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
  await env.request(env.setup,'/band/rooms/'+room.id+'/stop','POST',{version:started.data.room.version});
  assert.equal(env.store.db.prepare('SELECT state FROM band_takes WHERE id=?').get(takeId).state,'interrupted');
});
test('two instruments finish the same take, save separate idempotent reports and retain grouped history across restart',async t=>{
  const env=await bandFixture(t),created=await createRoom(env),{peers,room}=await readyRoom(env,created.data.room);
  const started=(await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:room.version})).data.room;
  const arr=builtinArrangement(),summary=part=>({total:part.chart.notes.length,hits:part.chart.notes.length,misses:0,wrong:0,extras:0,bestStreak:part.chart.notes.length,meanMs:-5,meanAbsMs:15});
  peers[1].send({type:'finish',takeId:started.takeId,summary:summary(arr.parts[0])});
  assert.match((await peers[1].wait(m=>m.type==='error')).message,/not finished/);
  env.advance(started.startAt+arr.duration*1000+400);
  for(const [index,peer] of peers.slice(1).entries()){
    peer.send({type:'finish',takeId:started.takeId,summary:summary(arr.parts[index])});await peer.wait(m=>m.type==='saved');
  }
  const completed=await peers[0].wait(m=>m.type==='room'&&m.room.state==='completed');
  assert.equal(completed.room.participants.length,2);
  peers[2].send({type:'finish',takeId:started.takeId,summary:summary(arr.parts[1])});await peers[2].wait(m=>m.type==='saved');
  assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,2);
  const a=await env.request(env.a,'/users/'+env.a.user.id+'/progress'),b=await env.request(env.b,'/users/'+env.b.user.id+'/progress');
  assert.equal(a.data.records[0].instrument,'drums');assert.equal(b.data.records[0].instrument,'keyboard');assert.equal(a.data.records[0].takeId,b.data.records[0].takeId);
  assert.equal((await env.request(env.a,'/users/'+env.b.user.id+'/progress')).status,404);
  assert.equal((await env.request(env.a,'/band/takes')).status,403);
  const judge=new PitchJudge(arr.parts[1].chart);for(const [i,note] of judge.chart.notes.entries()){note.status='hit';note.errorMs=i%2?10:-20;note.actualPitch=note.pitch;}judge.bestStreak=judge.chart.notes.length;
  const detail=makeRunReport(judge,{instrument:'keyboard'});
  assert.equal((await env.request(env.b,'/band/takes/'+started.takeId+'/report','POST',{report:detail})).status,200);
  assert.equal((await env.request(env.outsider,'/band/takes/'+started.takeId+'/report','POST',{report:detail})).status,404);
  assert.equal((await env.request(env.b,'/users/'+env.b.user.id+'/runs/'+b.data.records[0].id)).data.report.notes.length,detail.notes.length);
  const history=await env.request(env.setup,'/band/takes');assert.equal(history.data.takes[0].results.length,2);
  assert.equal((await env.request(env.other,'/band/takes')).data.takes.length,0);
  const schoolId=env.store.setting('school_id');
  const reopened=await ClassroomStore.open(env.directory);assert.equal(reopened.setting('school_id'),schoolId);assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,2);reopened.close();
});
test('library publishes mixed or keyboard-only MIDI parts and failed revisions preserve earlier music',async t=>{
  const env=await bandFixture(t),midi=duetMidi();
  const metadata={title:'Original test duet',fileName:'duet.mid',audioName:'',midiBytes:midi.length,audioBytes:0,selected:['0:9'],mapping:{},offset:0,timeScale:1,volume:0.65,parts:[{id:'drums',instrument:'drums',name:'Drums',selected:['0:9']},{id:'keyboard',instrument:'keyboard',name:'Keys',selected:['1:0']}]};
  const upload=async meta=>{
    const begin=await env.request(env.setup,'/library/uploads','POST',meta);assert.equal(begin.status,201);
    const id=begin.data.uploadId;assert.equal((await env.request(env.setup,'/library/uploads/'+id+'/midi','PUT',midi)).status,200);
    return env.request(env.setup,'/library/uploads/'+id+'/publish','POST',{});
  };
  const published=await upload(metadata);assert.equal(published.status,200);const song=published.data.song;
  const arrangement=await env.request(env.a,'/band/arrangements/school/'+song.id+'?revision='+song.revisionId);
  assert.equal(arrangement.data.arrangement.parts[1].chart.notes[0].pitch,60);assert.equal(arrangement.data.arrangement.parts[1].chart.notes[0].duration,0.25);
  const bad=await upload({...metadata,songId:song.id,revisionId:song.revisionId,parts:[{...metadata.parts[1],selected:['99:0']}]});assert.equal(bad.status,400);
  assert.equal((await env.request(env.a,'/library/'+song.id)).data.song.revisionId,song.revisionId);
  const keyboard=await upload({...metadata,title:'Keys only',selected:['1:0'],parts:[metadata.parts[1]]});assert.equal(keyboard.status,200);
  const catalog=await env.request(env.a,'/band/catalog');assert.ok(catalog.data.songs.some(song=>song.title==='Keys only'&&song.parts.length===1));
  const solo={id:randomUUID(),sourceKind:'school',sourceId:song.id,revisionId:song.revisionId,partId:'keyboard',summary:{total:2,hits:1,misses:0,wrong:1,extras:0,bestStreak:1,meanMs:10,meanAbsMs:10}};
  assert.equal((await env.request(env.b,'/band/runs','POST',solo)).status,200);
  assert.equal((await env.request(env.b,'/band/runs','POST',solo)).data.duplicate,true);
  assert.equal((await env.request(env.a,'/band/runs','POST',solo)).status,409);
});
test('existing drum-library MIDI exposes its piano without replacing the song, then supports both students and safe part updates',async t=>{
  const env=await bandFixture(t),midi=duetMidi(),audio=new Uint8Array(createDemoWav());
  const metadata={title:'Original piano and drums',fileName:'piano.mid',audioName:'original.wav',midiBytes:midi.length,audioBytes:audio.length,selected:['0:9'],mapping:{36:'tom3'},offset:-0.125,timeScale:1.25,volume:0.37};
  const publish=async meta=>{
    const begin=await env.request(env.setup,'/library/uploads','POST',meta);assert.equal(begin.status,201);
    const id=begin.data.uploadId;
    assert.equal((await env.request(env.setup,'/library/uploads/'+id+'/midi','PUT',midi)).status,200);
    assert.equal((await env.request(env.setup,'/library/uploads/'+id+'/audio','PUT',audio)).status,200);
    return env.request(env.setup,'/library/uploads/'+id+'/publish','POST',{});
  };
  const published=await publish(metadata);assert.equal(published.status,200);const song=published.data.song;
  assert.deepEqual(song.parts.map(part=>part.instrument),['drums','keyboard']);
  // Recreate metadata written before multi-instrument support. Reads must not rewrite it.
  const legacy={...song};for(const key of ['parts','arrangementVersion','id','revisionId','ownerId','ownerName','canManage','archived','savedAt'])delete legacy[key];
  const stored=JSON.stringify(legacy);env.store.db.prepare('UPDATE revisions SET metadata=? WHERE id=?').run(stored,song.revisionId);
  const schoolId=env.store.setting('school_id'),users=env.store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const catalog=await env.request(env.a,'/band/catalog');assert.equal(catalog.status,200);
  assert.deepEqual(catalog.data.songs.find(item=>item.id===song.id).parts.map(part=>part.instrument),['drums','keyboard']);
  const listed=(await env.request(env.b,'/library')).data.songs.find(item=>item.id===song.id);
  const loaded=(await env.request(env.b,'/library/'+song.id)).data.song;
  assert.equal(listed.parts[1].id,'keyboard');assert.equal(loaded.revisionId,song.revisionId);assert.equal(loaded.offset,-0.125);assert.equal(loaded.volume,0.37);
  assert.equal(env.store.db.prepare('SELECT metadata FROM revisions WHERE id=?').get(song.revisionId).metadata,stored);
  const {arrangement}= (await env.request(env.b,'/band/arrangements/school/'+song.id+'?revision='+song.revisionId)).data;
  assert.equal(arrangement.parts[0].chart.notes[0].drum,'tom3');assert.equal(arrangement.parts[1].chart.notes[1].time,0.625);
  assert.equal(arrangement.parts[1].chart.notes[0].pitch,60);assert.equal(arrangement.parts[1].chart.notes[0].duration,0.3125);
  assert.equal(arrangement.parts[0].chart.duration,arrangement.parts[1].chart.duration);assert.equal(arrangement.audio.offset,-0.125);assert.equal(arrangement.audio.volume,0.37);
  const created=await env.request(env.setup,'/band/rooms','POST',{sourceKind:'school',sourceId:song.id,revisionId:song.revisionId,assignments:[{userId:env.a.user.id,partId:'drums'},{userId:env.b.user.id,partId:'keyboard'}]});assert.equal(created.status,201);
  const {peers,room}=await readyRoom(env,created.data.room);
  const started=(await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:room.version})).data.room;
  env.advance(started.startAt+arrangement.duration*1000+400);
  for(const [index,peer] of peers.slice(1).entries()){
    const total=arrangement.parts[index].chart.notes.length;
    peer.send({type:'finish',takeId:started.takeId,summary:{total,hits:total,misses:0,wrong:0,extras:0,bestStreak:total,meanMs:0,meanAbsMs:0}});await peer.wait(m=>m.type==='saved');
  }
  await peers[0].wait(m=>m.type==='room'&&m.room.state==='completed');
  const updated=await publish({...metadata,songId:song.id,revisionId:song.revisionId,parts:loaded.parts});assert.equal(updated.status,200);
  assert.equal(updated.data.song.id,song.id);assert.notEqual(updated.data.song.revisionId,song.revisionId);
  assert.deepEqual(updated.data.song.mapping,metadata.mapping);assert.equal(updated.data.song.offset,metadata.offset);assert.equal(updated.data.song.timeScale,metadata.timeScale);assert.equal(updated.data.song.volume,metadata.volume);
  assert.deepEqual(await readFile(env.store.musicPath(song.revisionId,'midi')),Buffer.from(midi));assert.deepEqual(await readFile(env.store.musicPath(updated.data.song.revisionId,'audio')),Buffer.from(audio));
  assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM songs').get().n,1);assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,2);
  assert.equal(env.store.setting('school_id'),schoolId);assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,users);
  const stale=await env.request(env.setup,'/library/uploads','POST',{...metadata,songId:song.id,revisionId:song.revisionId,parts:loaded.parts});assert.equal(stale.status,409);
});

test('five students share a take while guitar, bass and vocal participation never creates performance scores',async t=>{
 const env=await bandFixture(t),people=[env.a,env.b,env.add('guitar'),env.add('bass'),env.add('singer')],partIds=['drums','keyboard','guitar','bass','vocals'];
 const assignments=people.map((p,i)=>({userId:p.user.id,partId:partIds[i]}));
 assert.equal((await env.request(env.setup,'/band/rooms','POST',{sourceKind:'duet',sourceId:'band-first',assignments:[assignments[0],assignments[0]]})).status,400);
 assert.equal((await env.request(env.setup,'/band/rooms','POST',{sourceKind:'duet',sourceId:'band-first',assignments:Array(9).fill(assignments[0])})).status,400);
 const created=await env.request(env.setup,'/band/rooms','POST',{sourceKind:'duet',sourceId:'band-first',assignments});assert.equal(created.status,201);const room=created.data.room;
 const peers=await Promise.all([env.wire(env.setup),...people.map(p=>env.wire(p))]);
 for(const [i,peer] of peers.entries()){peer.send({type:'join',roomId:room.id,clientId:'full-band-'+i});await peer.wait(m=>m.type==='room'&&m.room.id===room.id);}
 for(const peer of peers)peer.send({type:'ready',version:room.version,revisionId:room.arrangement.revisionId,audio:true,input:'Classroom test',sync:{samples:5,rttMs:10,uncertaintyMs:5}});
 const ready=(await peers[0].wait(m=>m.type==='room'&&m.room.teacherReady&&m.room.participants.every(p=>p.ready))).room;
 const started=(await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:ready.version})).data.room;
 peers[3].send({type:'finish',takeId:started.takeId,summary:{mode:'follow'}});assert.match((await peers[3].wait(m=>m.type==='error')).message,/not finished/);
 peers[3].send({type:'progress',takeId:started.takeId,position:1,summary:{mode:'follow',hits:100}});assert.match((await peers[3].wait(m=>m.type==='error')).message,/without a performance score/);
 env.advance(started.startAt+1000);peers[3].send({type:'progress',takeId:started.takeId,position:1,summary:{mode:'follow'}});
 const live=(await peers[0].wait(m=>m.type==='room'&&m.room.participants[2].progress)).room.participants[2].progress;assert.equal(live.mode,'follow');assert.equal(live.accuracy,undefined);
 peers[1].send({type:'progress',takeId:started.takeId,position:1,summary:{mode:'follow'}});assert.match((await peers[1].wait(m=>m.type==='error')).message,/Invalid progress/);
 const arrangement=builtinArrangement('band-first');env.advance(started.startAt+arrangement.duration*1000+400);
 for(const [i,peer] of peers.slice(1).entries()){
  const total=arrangement.parts[i].chart.notes.length,summary=i>=2?{mode:'follow'}:{total,hits:total,misses:0,wrong:0,extras:0,bestStreak:total,meanMs:0,meanAbsMs:0};
  peer.send({type:'finish',takeId:started.takeId,summary});await peer.wait(m=>m.type==='saved');
 }
 const finished=(await peers[0].wait(m=>m.type==='room'&&m.room.state==='completed')).room;assert.equal(finished.participants.length,5);
 for(const p of finished.participants.slice(2)){assert.equal(p.result.mode,'follow');assert.equal(p.result.accuracy,undefined);}
 assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,2);assert.equal(env.store.db.prepare("SELECT COUNT(*) AS n FROM band_results WHERE state='completed'").get().n,5);
 assert.equal((await env.request(people[2],'/band/runs','POST',{id:randomUUID(),sourceKind:'duet',sourceId:'band-first',partId:'guitar'})).status,400);
 const takes=(await env.request(env.setup,'/band/takes')).data.takes;assert.equal(takes[0].results.filter(p=>p.record.mode==='follow').length,3);
 const reopened=await ClassroomStore.open(env.directory);assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM band_results').get().n,5);reopened.close();
});

test('school publications retain editable timed lyrics with all band parts and support a lyrics-only assignment',async t=>{
 const env=await bandFixture(t),midi=ensembleMidi(),meta={title:'Original full band',fileName:'band.mid',midiBytes:midi.length,audioBytes:0,audioName:'',selected:['1:9'],mapping:{},offset:0.125,timeScale:1.25,volume:0.4,lyricsText:'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOur original line',lyricsClock:'recording',lyricsOffset:0.25};
 const upload=async metadata=>{const begun=await env.request(env.setup,'/library/uploads','POST',metadata);assert.equal(begun.status,201);const id=begun.data.uploadId;await env.request(env.setup,'/library/uploads/'+id+'/midi','PUT',midi);return env.request(env.setup,'/library/uploads/'+id+'/publish','POST',{});};
 const published=await upload(meta);assert.equal(published.status,200);const song=published.data.song;assert.equal(song.parts.length,5);assert.equal(song.lyricsText,meta.lyricsText);
 const arrangement=(await env.request(env.a,'/band/arrangements/school/'+song.id)).data.arrangement;assert.equal(arrangement.parts[4].chart.lyrics[0].time,1.375);assert.equal(arrangement.parts[4].chart.lyrics[0].end,2.375);
 const loaded=(await env.request(env.a,'/library/'+song.id)).data.song;assert.equal(loaded.lyricsClock,'recording');assert.equal(loaded.lyricsOffset,0.25);
 const vocals=await upload({...meta,title:'Original lyrics only',selected:[],parts:[{id:'vocals',instrument:'vocals',name:'Singer',selected:[]}]});assert.equal(vocals.status,200);assert.equal(vocals.data.song.parts.length,1);
 const missing=await upload({...meta,lyricsText:'',parts:[{id:'vocals',instrument:'vocals',name:'Singer',selected:[]}]});assert.equal(missing.status,400);
 assert.equal((await env.request(env.setup,'/library/uploads','POST',{...meta,lyricsText:'x'.repeat(10001)})).status,400);
});

test('schema migration preserves existing school identities, users, songs and recovery before adding band tables',async t=>{
  const env=await bandFixture(t),id=env.store.setting('school_id'),count=env.store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const midi=duetMidi(),begin=await env.request(env.setup,'/library/uploads','POST',{title:'Existing drum song',fileName:'old.mid',audioName:'',midiBytes:midi.length,audioBytes:0,selected:['0:9'],mapping:{},offset:0,timeScale:1,volume:0.65});
  await env.request(env.setup,'/library/uploads/'+begin.data.uploadId+'/midi','PUT',midi);
  const song=(await env.request(env.setup,'/library/uploads/'+begin.data.uploadId+'/publish','POST',{})).data.song;
  env.store.db.exec('DROP TABLE band_results; DROP TABLE band_takes; PRAGMA user_version=1;');
  const prepared=await prepareSchoolStorage({directory:env.directory,local:true,version:'0.11.0',env:{}});
  assert.equal(prepared.schoolId,id);assert.ok(prepared.snapshot.file.includes('0.11.0'));
  const migrated=await ClassroomStore.open(env.directory);
  assert.equal(migrated.setting('school_id'),id);assert.equal(migrated.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,count);assert.equal(migrated.db.prepare('PRAGMA user_version').get().user_version,2);
  assert.equal(migrated.getSong(env.a.user,song.id).revisionId,song.revisionId);
  assert.deepEqual(await readFile(migrated.musicPath(song.revisionId,'midi')),Buffer.from(midi));
  migrated.close();assert.ok((await readFile(path.join(env.directory,prepared.snapshot.file))).length);
});
test('a restarted server records an active take as interrupted and an old connection cannot save it as completed',async t=>{
  const env=await bandFixture(t),created=await createRoom(env),{peers,room}=await readyRoom(env,created.data.room);
  const started=(await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:room.version})).data.room;
  const replacement=new BandSessions(env.api);replacement.close();
  assert.equal(env.store.db.prepare('SELECT state FROM band_takes WHERE id=?').get(started.takeId).state,'interrupted');
  env.advance(started.startAt+builtinArrangement().duration*1000+500);
  peers[1].send({type:'finish',takeId:started.takeId,summary:{total:96,hits:96,misses:0,wrong:0,extras:0,bestStreak:96,meanMs:0,meanAbsMs:0}});
  assert.match((await peers[1].wait(m=>m.type==='error')).message,/interrupted/);
  assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
});
test('input interruption and revoked sessions cannot silently complete practice',async t=>{
  const env=await bandFixture(t),created=await createRoom(env),{peers,room}=await readyRoom(env,created.data.room);
  const started=(await env.request(env.setup,'/band/rooms/'+room.id+'/start','POST',{version:room.version})).data.room;
  env.store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(env.b.user.id);
  peers[2].send({type:'ping',id:'revoked-session'});await once(peers[2].socket,'close');
  const lost=await peers[0].wait(m=>m.type==='room'&&m.room.participants.some(p=>p.userId===env.b.user.id&&p.state==='interrupted'));
  assert.equal(lost.room.participants.find(p=>p.userId===env.b.user.id).connected,false);
  peers[0].send({type:'unready',version:started.version,reason:'Teacher sound stopped.'});
  await peers[0].wait(m=>m.type==='room'&&m.room.state==='interrupted');
  assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
});

test('default instruments are roster properties, respect account permissions and survive reopening storage',async t=>{
 const env=await bandFixture(t);
 assert.equal(env.store.user(env.a.user.id).default_instrument,null);
 assert.equal((await env.request(env.setup,'/users/'+env.a.user.id+'/instrument','POST',{defaultInstrument:'bass'})).status,200);
 assert.equal((await env.request(env.other,'/users/'+env.a.user.id+'/instrument','POST',{defaultInstrument:'guitar'})).status,404);
 assert.equal((await env.request(env.b,'/users/'+env.a.user.id+'/instrument','POST',{defaultInstrument:'vocals'})).status,403);
 assert.equal((await env.request(env.a,'/users/'+env.a.user.id+'/instrument','POST',{defaultInstrument:'keyboard'})).data.user.defaultInstrument,'keyboard');
 assert.equal((await env.request(env.a,'/users/'+env.a.user.id+'/instrument','POST',{defaultInstrument:'admin'})).status,400);
 assert.equal((await env.request(env.setup,'/users')).data.users.find(user=>user.id===env.a.user.id).defaultInstrument,'keyboard');
 const created=await env.request(env.setup,'/users','POST',{name:'Guitar student',username:'guitar.student',password:'test',defaultInstrument:'guitar'});assert.equal(created.data.user.defaultInstrument,'guitar');
 const reopened=await ClassroomStore.open(env.directory);assert.equal(reopened.makeSession(env.a.user.id).user.defaultInstrument,'keyboard');assert.equal(reopened.makeSession(created.data.user.id).user.defaultInstrument,'guitar');reopened.close();
});
test('stopped drum attempts retain private note reports and long completed reports persist without bloating history',async t=>{
 const env=await bandFixture(t);
 const save=async(judge,stopped=false,elapsed=judge.chart.duration)=>{
  const s=judge.summary(),c=judge.chart,report=makeRunReport(judge,{stopped,elapsed});
  const record={id:randomUUID(),sourceKind:'builtin',sourceId:'rock',title:c.title,hits:s.hits,total:s.total,extras:s.extras,bestStreak:s.bestStreak,meanMs:s.meanMs,meanAbsMs:s.meanAbsMs,bpm:80,endBpm:80,tolerance:140,focus:'all',section:'1–'+c.practice.endBar,full:!stopped,repeats:c.practice.repeats,drums:s.byDrum.map(({id,hits,total,meanMs,meanAbsMs})=>({id,hits,total,meanMs,meanAbsMs})),report};
  const saved=await env.request(env.a,'/runs','POST',record);assert.equal(saved.status,200,JSON.stringify(saved.data));return record;
 };
 const chart=createPracticeChart(createChart('rock',80,4)),live=new Judge(chart);live.strike('kick',0.01);const partial=stoppedJudge(live,0.8),record=await save(partial,true,0.8);
 const own=await env.request(env.a,'/users/'+env.a.user.id+'/runs/'+record.id);assert.equal(own.data.report.notes.length,partial.chart.notes.length);assert.equal(own.data.record.stopped,true);assert.equal(own.data.record.full,false);
 assert.equal((await env.request(env.b,'/users/'+env.a.user.id+'/runs/'+record.id)).status,404);assert.equal((await env.request(env.setup,'/users/'+env.a.user.id+'/runs/'+record.id)).status,200);
 const long=new Judge(createPracticeChart(createChart('rock',80,32),{enabled:true,startBar:1,endBar:32,repeats:4,focus:'all'}));long.advance(Infinity);const large=await save(long);assert.ok(JSON.stringify(large).length>32768);
 const history=await env.request(env.a,'/users/'+env.a.user.id+'/progress');assert.equal(history.data.records.length,2);assert.equal(history.data.records[0].report,undefined);assert.equal(history.data.records[0].reportAvailable,true);
 const reopened=await ClassroomStore.open(env.directory);assert.equal(reopened.runReport(env.a.user,env.a.user.id,record.id).report.stopped,true);reopened.close();
 const bad={...record,id:randomUUID(),report:{...record.report,notes:record.report.notes.slice(1)}};assert.equal((await env.request(env.a,'/runs','POST',bad)).status,400);
});
test('keyboard section and stopped attempts save distinct reports without claiming a completed shared take',async t=>{
 const env=await bandFixture(t),source=builtinArrangement().parts[1].chart,practice={enabled:true,startBar:2,endBar:3,repeats:4,focus:'all'},chart=createPracticeChart(source,practice),live=new PitchJudge(chart);live.strike(chart.notes[0].pitch,0.02);
 const judge=stoppedJudge(live,0.8),report=makeRunReport(judge,{instrument:'keyboard',stopped:true,elapsed:0.8}),id=randomUUID();
 const input={id,sourceKind:'duet',sourceId:'duet-first',revisionId:'duet-v1',partId:'keyboard',summary:partSummary(judge),practice,report};
 assert.equal((await env.request(env.b,'/band/runs','POST',input)).status,200);assert.equal((await env.request(env.b,'/band/runs','POST',input)).data.duplicate,true);
 const saved=await env.request(env.b,'/users/'+env.b.user.id+'/runs/'+id);assert.equal(saved.data.record.stopped,true);assert.equal(saved.data.record.section,'2–3');assert.equal(saved.data.record.repeats,4);assert.equal(saved.data.record.full,false);assert.equal(saved.data.report.notes[0][7],2);assert.equal(env.store.db.prepare('SELECT COUNT(*) AS n FROM band_takes').get().n,0);
 const bad={...input,id:randomUUID(),summary:{...input.summary,total:source.notes.length}};assert.equal((await env.request(env.b,'/band/runs','POST',bad)).status,400);
});
