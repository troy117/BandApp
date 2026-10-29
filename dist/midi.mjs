import { parseMidi } from './vendor/midi-parser.mjs';
import { DRUMS, mappedDrum } from './engine.mjs';

export const GM_DRUMS = {
  22: ['Closed hi-hat edge (TD-17)', 'hihat-closed'], 26: ['Open hi-hat edge (TD-17)', 'hihat-open'],
  35: ['Acoustic bass drum', 'kick'], 36: ['Bass drum', 'kick'], 37: ['Side stick', 'snare'],
  38: ['Acoustic snare', 'snare'], 39: ['Hand clap', 'snare'], 40: ['Electric snare', 'snare'],
  41: ['Low floor tom', 'tom3'], 42: ['Closed hi-hat', 'hihat-closed'], 43: ['High floor tom', 'tom3'],
  44: ['Pedal hi-hat', 'hihat-pedal'], 45: ['Low tom', 'tom2'], 46: ['Open hi-hat', 'hihat-open'],
  47: ['Low-mid tom', 'tom2'], 48: ['Hi-mid tom', 'tom1'], 49: ['Crash cymbal 1', 'crash'],
  50: ['High tom', 'tom1'], 51: ['Ride cymbal 1', 'ride'], 52: ['Chinese cymbal', 'crash'],
  53: ['Ride bell', 'ride'], 54: ['Tambourine', 'ignore'], 55: ['Splash cymbal', 'crash'],
  56: ['Cowbell', 'ignore'], 57: ['Crash cymbal 2', 'crash'], 58: ['Vibraslap', 'ignore'],
  59: ['Ride cymbal 2', 'ride'],
};
const lastBefore = (items, value, field) => {
  let lo = 0, hi = items.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (items[mid][field] <= value) lo = mid + 1; else hi = mid; }
  return items[Math.max(0, lo - 1)];
};
const uniqueAtTick = (items, initial) => {
  const map = new Map([[0, { ...initial, tick: 0 }]]);
  for (const item of [...items].sort((a, b) => a.tick - b.tick)) map.set(item.tick, item);
  return [...map.values()].sort((a, b) => a.tick - b.tick);
};
export function buildTimeline(ppq, tempoEvents, signatureEvents) {
  const tempos = uniqueAtTick(tempoEvents, { microsecondsPerBeat: 500000 });
  let seconds = 0;
  for (let i = 0; i < tempos.length; i++) {
    const tempo = tempos[i];
    if (!Number.isFinite(tempo.microsecondsPerBeat) || tempo.microsecondsPerBeat < 100000 || tempo.microsecondsPerBeat > 6000000) throw new Error('MIDI tempo must be between 10 and 600 BPM.');
    if (i) seconds += (tempo.tick - tempos[i - 1].tick) / ppq * tempos[i - 1].microsecondsPerBeat / 1000000;
    tempo.seconds = seconds;
  }
  const signatures = uniqueAtTick(signatureEvents, { numerator: 4, denominator: 4 });
  for (let i = 0; i < signatures.length; i++) {
    const signature = signatures[i];
    if (!Number.isInteger(signature.numerator) || signature.numerator < 1 || signature.numerator > 32 || ![1, 2, 4, 8, 16, 32].includes(signature.denominator)) throw new Error('This MIDI time signature is not supported (use a denominator of 1–32).');
    signature.beatTicks = ppq * 4 / signature.denominator;
    signature.barTicks = signature.beatTicks * signature.numerator;
    signature.startBar = i ? signatures[i - 1].startBar + Math.ceil((signature.tick - signatures[i - 1].tick) / signatures[i - 1].barTicks - 1e-8) : 1;
  }
  const tickToSeconds = tick => {
    const segment = lastBefore(tempos, tick, 'tick');
    return segment.seconds + (tick - segment.tick) / ppq * segment.microsecondsPerBeat / 1000000;
  };
  const secondsToTick = time => {
    const segment = lastBefore(tempos, time, 'seconds');
    return segment.tick + (time - segment.seconds) * 1000000 / segment.microsecondsPerBeat * ppq;
  };
  const position = tick => {
    const segment = lastBefore(signatures, tick, 'tick');
    const relative = Math.max(0, tick - segment.tick);
    return { bar: segment.startBar + Math.floor((relative + 1e-7) / segment.barTicks), beat: 1 + relative % segment.barTicks / segment.beatTicks, numerator: segment.numerator, denominator: segment.denominator };
  };
  return { tempos, signatures, tickToSeconds, secondsToTick, position };
}
export function parseMidiSong(input, fileName = 'Imported song.mid') {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 14 || bytes.length > 10 * 1024 * 1024) throw new Error('Choose a valid MIDI file smaller than 10 MB.');
  if (String.fromCharCode(...bytes.slice(0, 4)) !== 'MThd') throw new Error('This is not a standard MIDI file. Choose a .mid or .midi file.');
  let parsed;
  try { parsed = parseMidi(bytes); } catch (error) { throw new Error(`Could not read this MIDI file: ${String(error.message || error).slice(0, 180)}`); }
  const { header, tracks } = parsed;
  if (![0, 1].includes(header.format)) throw new Error('MIDI format 2 has separate song sequences. Export a format 0 or format 1 MIDI instead.');
  if (!header.ticksPerBeat) throw new Error('SMPTE-timed MIDI is not supported yet. Export MIDI with musical beat timing.');
  if (header.numTracks !== tracks.length || !tracks.length || header.numTracks > 512) throw new Error('The MIDI file is incomplete or contains too many tracks.');
  const tempos = [], signatures = [], parts = [], lyricEvents = [], karaokeEvents = [];
  const programEvents = new Map();
  for (const events of tracks) {
    let tick = 0;
    for (const event of events) {
      tick += event.deltaTime;
      if (event.type !== 'programChange') continue;
      if (!programEvents.has(event.channel)) programEvents.set(event.channel, []);
      programEvents.get(event.channel).push({ tick, program: event.programNumber });
    }
  }
  for (const events of programEvents.values()) events.sort((a, b) => a.tick - b.tick);
  let endTick = 0;
  tracks.forEach((events, trackIndex) => {
    let tick = 0;
    const name = events.find(event => event.type === 'trackName')?.text || `Track ${trackIndex + 1}`;
    const instrumentName = events.find(event => event.type === 'instrumentName')?.text || '';
    const karaokeTrack = /lyric|words|karaoke/i.test(name) || events.some(item => item.type === 'text' && /^@KMIDI/.test(item.text));
    const channels = new Map(), held = new Map();
    for (const event of events) {
      tick += event.deltaTime;
      if (!Number.isSafeInteger(tick) || tick < 0) throw new Error('The MIDI contains invalid note timing.');
      if (event.type === 'setTempo') tempos.push({ tick, microsecondsPerBeat: event.microsecondsPerBeat });
      if (event.type === 'timeSignature') signatures.push({ tick, numerator: event.numerator, denominator: event.denominator });
      if (event.type === 'lyrics') lyricEvents.push({tick,text:event.text,track:trackIndex});
      if (event.type === 'text' && karaokeTrack) karaokeEvents.push({tick,text:event.text,track:trackIndex});
      if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        const queue = held.get(event.channel + ':' + event.noteNumber);
        const note = queue?.shift();
        if (note) note.endTick = tick;
        continue;
      }
      if (event.type !== 'noteOn') continue;
      if (!Number.isInteger(event.noteNumber) || event.noteNumber < 0 || event.noteNumber > 127 || !Number.isInteger(event.velocity) || event.velocity < 1 || event.velocity > 127) throw new Error('The MIDI contains an invalid note.');
      if (!channels.has(event.channel)) channels.set(event.channel, { id: `${trackIndex}:${event.channel}`, name, instrumentName, track: trackIndex + 1, channel: event.channel + 1, programs: [], notes: [] });
      const part = channels.get(event.channel), channelPrograms = programEvents.get(event.channel);
      const program = channelPrograms?.length && channelPrograms[0].tick <= tick ? lastBefore(channelPrograms, tick, 'tick').program : undefined;
      if (program !== undefined && !part.programs.includes(program)) part.programs.push(program);
      const note = { tick, pitch: event.noteNumber, velocity: event.velocity };
      channels.get(event.channel).notes.push(note);
      const key = event.channel + ':' + event.noteNumber;
      if (!held.has(key)) held.set(key, []);
      held.get(key).push(note);
    }
    endTick = Math.max(endTick, tick);
    for (const queue of held.values()) for (const note of queue) note.endTick = Math.max(note.tick, tick);
    parts.push(...channels.values());
  });
  if (!parts.length) throw new Error('This MIDI contains no played notes.');
  const timeline = buildTimeline(header.ticksPerBeat, tempos, signatures);
  const lastOnset = Math.max(...parts.map(part => part.notes.at(-1)?.tick || 0));
  // Chart gems can have zero duration. Leave their final strike a musical tail.
  endTick = Math.max(endTick, lastOnset + header.ticksPerBeat / 4);
  const duration = timeline.tickToSeconds(endTick);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 1200) throw new Error('Choose a MIDI song shorter than 20 minutes.');
  for (const part of parts) {
    part.rhythmGame = /PART\s+DRUMS/i.test(part.name);
    part.drumCandidate = part.channel === 10 || /drum|percussion/i.test(part.name);
    // Only explicit instrument evidence suggests piano. An unnamed melodic track
    // without a program change might be guitar, bass or another instrument.
    const label = part.name + ' ' + part.instrumentName;
    const namedKeyboard = /\b(piano|pianoforte|keyboard|keys|clavinet|clavi|celesta|harpsichord|rhodes|wurlitzer)\b/i.test(label);
    const namedOther = /\b(guitar|bass|vocal|voice|strings|violin|cello|sax|trumpet|flute)\b/i.test(label);
    const pianoProgram = part.programs.length > 0 && part.programs.every(program => program >= 0 && program <= 7);
    part.keyboardCandidate = !part.drumCandidate && (namedKeyboard || pianoProgram && !namedOther);
    part.bassCandidate = !part.drumCandidate && (/\bbass\b/i.test(label) || part.programs.length > 0 && part.programs.every(program => program >= 32 && program <= 39));
    part.guitarCandidate = !part.drumCandidate && !part.bassCandidate && (/\bguitar\b/i.test(label) || part.programs.length > 0 && part.programs.every(program => program >= 24 && program <= 31));
    part.vocalCandidate = !part.drumCandidate && /\b(vocals?|voice|singer|singing|choir)\b/i.test(label);
    if (part.bassCandidate || part.guitarCandidate || part.vocalCandidate) part.keyboardCandidate = false;
  }
  let selected = parts.filter(part => part.drumCandidate).map(part => part.id);
  if (!selected.length) {
    const candidate = [...parts].sort((a, b) => {
      const ratio = part => part.notes.filter(note => GM_DRUMS[note.pitch]?.[1] && GM_DRUMS[note.pitch][1] !== 'ignore').length / part.notes.length;
      return ratio(b) - ratio(a);
    })[0];
    selected = [candidate.id];
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return { title: fileName.replace(/\.midi?$/i, ''), fileName, fingerprint: `${bytes.length}-${hash.toString(16)}`, ppq: header.ticksPerBeat, endTick, duration, parts, selected, timeline, lyricEvents:(lyricEvents.length ? lyricEvents : karaokeEvents).sort((a,b) => a.tick-b.tick) };
}
export function pitchChoices(song, selected) {
  const counts = new Map();
  for (const part of song.parts.filter(part => selected.includes(part.id))) for (const note of part.notes) counts.set(note.pitch, (counts.get(note.pitch) || 0) + 1);
  return [...counts].sort((a, b) => a[0] - b[0]).map(([pitch, count]) => ({ pitch, count, name: GM_DRUMS[pitch]?.[0] || `MIDI note ${pitch}`, defaultDrum: GM_DRUMS[pitch]?.[1] || 'ignore' }));
}
export function makeMidiChart(song, selected, mapping = {}, pickupQuarters=0) {
  if (!selected.length) throw new Error('Select at least one drum part.');
  const chosen = song.parts.filter(part => selected.includes(part.id));
  const all = chosen.flatMap(part => part.notes).sort((a, b) => a.tick - b.tick);
  const notes = [], seen = new Set();
  let ignored = 0, combined = 0;
  for (const note of all) {
    const drum = mappedDrum(note.pitch,mapping[note.pitch] ?? GM_DRUMS[note.pitch]?.[1] ?? 'ignore');
    if (!DRUMS.some(item => item.id === drum)) { ignored++; continue; }
    const id = `${note.tick}:${drum}`;
    if (seen.has(id)) { combined++; continue; }
    seen.add(id);
    const position = song.timeline.position(note.tick);
    notes.push({ id, drum, tick: note.tick, quarter: note.tick / song.ppq, midiPitch: note.pitch, velocity: note.velocity / 127, bar: position.bar, beat: position.beat, time: song.timeline.tickToSeconds(note.tick), status: 'pending', errorMs: null, actualTime: null });
  }
  if (!notes.length) throw new Error('No drum hits are mapped. Select a drum part and assign at least one note to a drum.');
  if (notes.length > 50000) throw new Error('Choose a part with fewer than 50,000 drum hits.');
  const grid=midiTimeGrid(song,pickupQuarters);
  if(pickupQuarters){let i=0;for(const note of notes){while(i+1<grid.measures.length&&grid.measures[i+1].time<=note.time+1e-7)i++;const m=grid.measures[i];note.bar=m.bar;note.beat=1+(m.beatOffset||0)+(note.quarter-m.startQuarter)/(4/m.denominator);}}
  return { ...grid, notes, ignored, combined };
}
export function validatePickup(value=0) {
  if(!Number.isFinite(value)||value<0||value>32)throw new Error('Choose a pickup length between 0 and 32 quarter notes.');return value;
}
export function midiTimeGrid(song, pickupQuarters = 0) {
  validatePickup(pickupQuarters);
  if(pickupQuarters)return pickupMidiGrid(song,pickupQuarters);
  const beats = [];
  const signatures = song.timeline.signatures;
  for (let i = 0; i < signatures.length; i++) {
    const signature = signatures[i];
    const end = Math.min(song.endTick, signatures[i + 1]?.tick ?? song.endTick);
    for (let tick = signature.tick, index = 0; tick < end - 1e-7; tick += signature.beatTicks, index++) {
      const position = song.timeline.position(tick);
      beats.push({ time: song.timeline.tickToSeconds(tick), quarter: tick / song.ppq, bar: position.bar, beat: position.beat, downbeat: index % signature.numerator === 0 });
      if (beats.length > 40000) throw new Error('This MIDI contains too many metronome beats.');
    }
  }
  const signature = signatures[0];
  const firstBpm = 60000000 / song.timeline.tempos[0].microsecondsPerBeat;
  const measures = [];
  for (let i = 0; i < signatures.length; i++) {
    const meter = signatures[i], end = Math.min(song.endTick, signatures[i + 1]?.tick ?? song.endTick);
    for (let tick = meter.tick; tick < end - 1e-7; tick += meter.barTicks) {
      const to = Math.min(end, tick + meter.barTicks);
      measures.push({ bar: song.timeline.position(tick).bar, startQuarter: tick / song.ppq, endQuarter: to / song.ppq, time: song.timeline.tickToSeconds(tick), endTime: song.timeline.tickToSeconds(to), numerator: meter.numerator, denominator: meter.denominator });
    }
  }
  return {
    kind: 'midi', title: song.title, notes: [], beats, bpm: firstBpm, bars: song.timeline.position(Math.max(0, song.endTick - 1e-5)).bar,
    duration: song.duration, endQuarter: song.endTick / song.ppq, measures, countInBeats: signature.numerator, countInBeatSeconds: 60 / firstBpm * 4 / signature.denominator,
    numerator: signature.numerator, denominator: signature.denominator,
    tempoChanges: song.timeline.tempos.length - 1, signatureChanges: signatures.length - 1, ignored:0, combined:0,
    signatures: signatures.map(item => ({ time: song.timeline.tickToSeconds(item.tick), numerator: item.numerator, denominator: item.denominator })),
    tempos: song.timeline.tempos.map(item => ({ time: item.seconds, quarter: item.tick / song.ppq, bpm: 60000000 / item.microsecondsPerBeat })),
  };
}
function pickupMidiGrid(song,pickup) {
  const grid=midiTimeGrid(song),first=song.timeline.signatures[0],nominal=first.numerator*4/first.denominator;
  if(pickup>=nominal||pickup>=song.endTick/song.ppq||song.timeline.signatures[1]&&pickup>=song.timeline.signatures[1].tick/song.ppq)throw new Error('The pickup must be shorter than the first full bar.');
  const measures=[],beats=[];let bar=1;
  for(let i=0;i<song.timeline.signatures.length;i++){
    const meter=song.timeline.signatures[i],end=Math.min(song.endTick,song.timeline.signatures[i+1]?.tick??song.endTick)/song.ppq,unit=4/meter.denominator,length=unit*meter.numerator;
    for(let q=meter.tick/song.ppq;q<end-1e-8;){
      const short=!i&&q===0,to=Math.min(end,q+(short?pickup:length)),missing=short?length-pickup:0;
      measures.push({bar,startQuarter:q,endQuarter:to,time:song.timeline.tickToSeconds(q*song.ppq),endTime:song.timeline.tickToSeconds(to*song.ppq),numerator:meter.numerator,denominator:meter.denominator,...(short?{pickup:true,beatOffset:missing/unit}:{})});
      for(let beat=Math.ceil(missing/unit-1e-8);beat<meter.numerator;beat++){
        const quarter=q+beat*unit-missing;if(quarter>=to-1e-8)break;
        beats.push({time:song.timeline.tickToSeconds(quarter*song.ppq),quarter,bar,beat:beat+1,downbeat:beat===0});
      }
      bar++;q=to;
    }
  }
  return {...grid,measures,beats,bars:measures.length,pickupQuarters:pickup,countInOffset:beats[0]?.time||0};
}
export function backingSchedule(startAt, offsetSeconds, duration) {
  if (![startAt, offsetSeconds, duration].every(Number.isFinite) || duration <= 0) throw new Error('Invalid backing audio timing.');
  const skip = Math.max(0, -offsetSeconds);
  if (skip >= duration) throw new Error('The audio offset skips the entire recording. Choose a smaller negative offset.');
  return { when: startAt + Math.max(0, offsetSeconds), offset: skip };
}
