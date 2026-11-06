import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseMidiSong,makeMidiChart} from '../dist/midi.mjs';
import {DRUM_DIFFICULTIES,simplifyDrumChart} from '../dist/drum-difficulty.mjs';
import {exportDrumMidi} from './drum-midi.mjs';

const [inputDirectory,outputDirectory,pickupFile]=process.argv.slice(2);
if(!outputDirectory)throw new Error('Usage: node scripts/create-drum-difficulties.mjs input-folder new-output-folder [pickup-fingerprints.json]');
if(path.resolve(inputDirectory)===path.resolve(outputDirectory))throw new Error('Use a separate output folder to preserve the original files.');
const pickups=pickupFile?JSON.parse(await fs.readFile(pickupFile,'utf8')):{};
await fs.mkdir(outputDirectory,{recursive:true});
const results=[];
for(const file of (await fs.readdir(inputDirectory)).filter(f=>/\.midi?$/i.test(f)).sort()){
  const bytes=await fs.readFile(path.join(inputDirectory,file)),song=parseMidiSong(bytes,file);
  const named=song.parts.filter(p=>p.drumCandidate&&/\bdrums?\b|\bkit\b/i.test(p.name)),selected=named.length?named.map(p=>p.id):song.parts.filter(p=>p.drumCandidate).map(p=>p.id);
  if(!selected.length)throw new Error(file+': No identified drum track. Assign its drum track explicitly before exporting.');
  const original=makeMidiChart(song,selected,{},pickups[song.fingerprint]||0),stem=file.replace(/\.midi?$/i,'').replace(/-\d{2}-\d{2}-\d{4}$/,'');
  const variants=[];let previous=0;
  for(const [id,info]of Object.entries(DRUM_DIFFICULTIES)){
    const chart=simplifyDrumChart(original,id),name=stem+'__'+info.label+' drums.mid',midi=exportDrumMidi(song,chart,stem+' · '+info.label+' drums');
    const restored=parseMidiSong(midi,name),played=makeMidiChart(restored,restored.selected);
    assert.equal(played.notes.length,chart.notes.length);assert(Math.abs(restored.duration-song.duration)<1e-7);
    assert.equal(restored.timeline.tempos.length,song.timeline.tempos.length);
    for(let i=0;i<played.notes.length;i++){assert(Math.abs(played.notes[i].time-chart.notes[i].time)<1e-6);assert.equal(played.notes[i].drum,chart.notes[i].drum);}
    assert(chart.notes.every(n=>original.notes.some(o=>o.id===n.id&&o.time===n.time)),'Every note must retain an original attack.');
    assert(chart.notes.length>=previous,'Difficulty levels must add notes progressively.');previous=chart.notes.length;
    await fs.writeFile(path.join(outputDirectory,name),midi,{flag:'wx'});
    variants.push({id,label:info.label,file:name,notes:chart.notes.length,kicks:chart.notes.filter(n=>n.drum==='kick').length,lanes:[...new Set(chart.notes.map(n=>n.drum))],removed:original.notes.length-chart.notes.length});
  }
  results.push({sourceFile:file,fingerprint:song.fingerprint,selected,pickupQuarters:original.pickupQuarters||0,duration:song.duration,bpm:original.bpm,meterChanges:original.signatureChanges,originalNotes:original.notes.length,variants});
  console.log(stem+': '+variants.map(v=>v.label+' '+v.notes).join(' / '));
}
if(!results.length)throw new Error('No MIDI files found in that folder.');
await fs.writeFile(path.join(outputDirectory,'manifest.json'),JSON.stringify({version:1,songs:results},null,2),{flag:'wx'});
const csv=[['Song','Difficulty','Drum hits','Removed','Kick hits','Kit lanes','Seconds','MIDI file'],...results.flatMap(s=>s.variants.map(v=>[s.sourceFile,v.label,v.notes,v.removed,v.kicks,v.lanes.join(' / '),s.duration,v.file]))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
await fs.writeFile(path.join(outputDirectory,'Song comparison.csv'),csv,{flag:'wx'});
await fs.writeFile(path.join(outputDirectory,'READ ME.txt'),`Drum difficulty versions\n\n${results.length} songs; Beginner, Easy, Intermediate and Original drum-only MIDIs.\n\nBeginner: closed hi-hat pulse, main snare and widely spaced kicks; three lanes.\nEasy: a faster hi-hat pulse with the main kick/snare pattern; three lanes.\nIntermediate: fewer kick bursts and ghost notes, shorter one-tom fills, simpler cymbal combinations.\nOriginal: the mapped original drum-kit part. Other instruments and unmapped percussion are omitted.\n\nEach easier level retains original attack times; no notes are moved and silent bars remain silent. Ride/open/crash hits become closed hi-hat on the two easiest levels. A fill-only bar can become one snare cue at an existing attack. Compound-meter pulses and swing are respected. These are automatic teaching reductions, not a new transcription. Tempo is unchanged: loop short sections to learn fast songs.\n\nOriginal files and backing recordings are untouched. Use the existing aligned recording as backing. Each MIDI includes the full song duration, tempo changes and meter changes. A known pickup uses a short opening time signature followed by the normal meter; absolute timing is unchanged. The CSV compares every version.\n`,{flag:'wx'});
