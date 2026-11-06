// Drum-only Standard MIDI File export. Source ticks, tempos, meter changes and
// complete duration remain unchanged; these files contain no backing recording.
const midiVariable=value=>{const bytes=[value&127];while((value=Math.floor(value/128)))bytes.unshift((value&127)|128);return bytes;};
const midiU32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
const midiText=value=>[...new TextEncoder().encode(value)];
const midiChunk=(name,bytes)=>[...midiText(name),...midiU32(bytes.length),...bytes];
const midiMeta=(type,bytes)=>[255,type,...midiVariable(bytes.length),...bytes];
function drumMidiTrack(events,endTick){
  const bytes=[];let previous=0;
  for(const event of events.sort((a,b)=>a.tick-b.tick||(a.order||0)-(b.order||0))){bytes.push(...midiVariable(event.tick-previous),...event.bytes);previous=event.tick;}
  bytes.push(...midiVariable(Math.max(0,endTick-previous)),255,47,0);return midiChunk('MTrk',bytes);
}
const drumMidiPitches={kick:36,snare:38,hihat:42,'hihat-open':46,'hihat-pedal':44,tom1:48,tom2:45,tom3:41,crash:49,ride:51};
export function exportDrumMidi(song,chart,title=chart.title){
  const conductor=[{tick:0,order:-3,bytes:midiMeta(3,midiText(title))},...song.timeline.tempos.map(t=>({tick:t.tick,bytes:midiMeta(81,[(t.microsecondsPerBeat>>>16)&255,(t.microsecondsPerBeat>>>8)&255,t.microsecondsPerBeat&255])}))];
  const signatures=song.timeline.signatures.map(s=>({tick:s.tick,numerator:s.numerator,denominator:s.denominator}));
  if(chart.pickupQuarters){const q=chart.pickupQuarters,den=[4,8,16,32].find(d=>Number.isInteger(q*d/4)&&q*d/4>=1&&q*d/4<=32);if(!den)throw new Error('The pickup cannot be represented by this MIDI exporter.');const initial=signatures[0];signatures[0]={tick:0,numerator:q*den/4,denominator:den};signatures.splice(1,0,{...initial,tick:Math.round(q*song.ppq)});}
  conductor.push(...signatures.map(s=>({tick:s.tick,bytes:midiMeta(88,[s.numerator,Math.log2(s.denominator),24,8])})));
  const hits=[{tick:0,order:-1,bytes:midiMeta(3,midiText('Drums · '+(chart.drumDifficulty||'original')))}];
  for(const note of chart.notes){const pitch=note.midiPitch??drumMidiPitches[note.drum],tick=note.tick??Math.round(song.timeline.secondsToTick(note.time));if(!Number.isInteger(pitch)||pitch<0||pitch>127)throw new Error('Invalid drum MIDI pitch.');hits.push({tick,order:1,bytes:[153,pitch,Math.max(1,Math.min(127,Math.round((note.velocity??.8)*127)))]},{tick:Math.min(song.endTick,tick+Math.max(1,Math.round(song.ppq/32))),order:0,bytes:[137,pitch,0]});}
  return Uint8Array.from([...midiChunk('MThd',[0,1,0,2,(song.ppq>>>8)&255,song.ppq&255]),...drumMidiTrack(conductor,song.endTick),...drumMidiTrack(hits,song.endTick)]);
}
