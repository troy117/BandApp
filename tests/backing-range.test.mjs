import test from 'node:test';
import assert from 'node:assert/strict';
import { backingClip, validateAudioRange } from '../dist/backing-range.mjs';
import { backingSegments } from '../dist/practice.mjs';
import { ClassroomStore } from '../server/classroom.mjs';

test('recording cuts retain original alignment through starts, seeks and repeated sections',()=>{
 const backing={buffer:{duration:50},offset:-10,audioStart:12,audioEnd:30};
 assert.deepEqual(backingClip(backing,0,40),{when:2,offset:12,duration:18});
 assert.deepEqual(backingClip(backing,8,15),{when:8,offset:18,duration:7});assert.equal(backingClip(backing,21,40),null);
 assert.deepEqual(backingSegments({passes:[{from:0,to:5,time:0},{from:0,to:5,time:5}]},backing),[{when:2,offset:12,duration:3},{when:7,offset:12,duration:3}]);
});
test('clip validation rejects invalid cuts and keeps legacy songs using their entire recordings',()=>{
 assert.deepEqual(validateAudioRange({}),{});assert.deepEqual(validateAudioRange({audioStart:0,audioEnd:null}),{});
 for(const input of [{audioStart:-1},{audioStart:Infinity},{audioStart:4,audioEnd:3},{audioEnd:0},{audioEnd:21}])assert.throws(()=>validateAudioRange(input,20));
 assert.deepEqual(validateAudioRange({audioStart:2,audioEnd:18},20),{audioStart:2,audioEnd:18});
});
test('school upload metadata keeps reversible cuts and rejects malformed recording ranges',()=>{
 const input={title:'Original music',fileName:'original.mid',midiBytes:100,audioBytes:100,audioName:'original.wav',selected:['0:9'],mapping:{},offset:-1,timeScale:1,volume:.5,audioStart:2,audioEnd:8};
 const meta=ClassroomStore.prototype.metadata(input);assert.equal(meta.audioStart,2);assert.equal(meta.audioEnd,8);assert.equal(meta.offset,-1);
 assert.throws(()=>ClassroomStore.prototype.metadata({...input,audioEnd:1}));
});
