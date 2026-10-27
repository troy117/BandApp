import {readFile,writeFile} from 'node:fs/promises';
import {parseMidiSong} from '../dist/midi.mjs';
import {validateFrettedPart} from '../dist/fretted-parts.mjs';

const [midiPath,sourcePath,output]=process.argv.slice(2);
if(!output)throw new Error('Usage: node scripts/prepare-fretted-guide.mjs matching.mid quarters.json guide.json');
const song=parseMidiSong(await readFile(midiPath),midiPath),score=JSON.parse(await readFile(sourcePath,'utf8'));
if(score.format!=='bandapp-gp-quarters'||score.version!==1)throw new Error('Choose output from read-guitar-pro.py.');
if(score.quarters>song.endTick/song.ppq+.001||song.endTick/song.ppq-score.quarters>8)throw new Error('The score length does not match this MIDI.');
const seconds=q=>song.timeline.tickToSeconds(q*song.ppq);
const parts=score.parts.map((part,i)=>{
  const selected=song.parts.filter(p=>Number(p.id.split(':')[0])===part.track).map(p=>p.id);
  if(!selected.length)throw new Error('Missing source MIDI track '+part.track);
  const data={id:part.instrument+'-'+i,instrument:part.instrument,name:part.name.slice(0,60),selected,tuning:part.tuning,
    tablature:{version:1,notes:part.notes.map(({quarter,durationQ,bar,...note})=>({...note,time:seconds(quarter),duration:seconds(quarter+durationQ)-seconds(quarter)}))}};
  return {...data,...validateFrettedPart(data)};
});
await writeFile(output,JSON.stringify({format:'bandapp-fretted-guide',version:1,fingerprint:song.fingerprint,pickupQuarters:score.pickupQuarters,parts}));
console.log(JSON.stringify({fingerprint:song.fingerprint,pickupQuarters:score.pickupQuarters,parts:parts.map(p=>({id:p.id,name:p.name,notes:p.tablature.notes.length,tuning:p.tuning}))}));
