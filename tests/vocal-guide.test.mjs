import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMidiSong } from '../dist/midi.mjs';
import { importedArrangement, partSummary } from '../dist/arrangements.mjs';
import { vocalMelody, vocalTarget, vocalStaffPosition, drawVocalStaff } from '../dist/vocal-guide.mjs';
import { FollowCursor } from '../dist/follow-along.mjs';
import { arrangementFromBar } from '../dist/session-transport.mjs';
import { ensembleMidi } from './ensemble-fixture.mjs';

test('a vocal guide uses selected MIDI pitches, releases and tempo changes without inventing lyric syllables', () => {
  const song = parseMidiSong(ensembleMidi()), melody = vocalMelody(song, ['2:0']);
  assert.deepEqual(melody.map(note => note.pitch), [60, 64, 67, 72]);
  assert.equal(melody[0].duration, 0.375);
  const metadata = { parts: [{ id: 'vocals', name: 'Lead vocals', instrument: 'vocals', selected: ['2:0'] }], lyricsText: '[00:00.00]Find the beat\n[00:03.00]Play together', timeScale: 1.25 };
  const arrangement = importedArrangement(song, metadata), chart = arrangement.parts[0].chart;
  assert.equal(chart.notes[1].time, melody[1].time * 1.25);
  assert.equal(chart.notes[0].duration, melody[0].duration * 1.25);
  assert.equal(chart.lyrics.length, 2);
  assert.deepEqual(partSummary(new FollowCursor(chart)), { mode: 'follow' });
  assert.equal(arrangementFromBar(arrangement, 2).parts[0].chart.notes.length, 0);
  const textOnly = importedArrangement(song, { ...metadata, parts: [{ ...metadata.parts[0], selected: [] }] });
  assert.equal(textOnly.parts[0].chart.notes.length, 0);
});

test('vocal targets respect held notes, rests and real octaves, including concurrent pitches', () => {
  const notes = [{ pitch: 57, time: 1, duration: 1.5 }, { pitch: 60, time: 3, duration: 1 }, { pitch: 64, time: 3, duration: 1 }];
  assert.equal(vocalTarget(notes, 0).label, 'Rest · next A3');
  assert.equal(vocalTarget(notes, 2).label, 'A3');
  assert.equal(vocalTarget(notes, 2.5).label, 'Rest · next C4');
  assert.equal(vocalTarget(notes, 3.5).label, 'C4 + E4');
  assert.equal(vocalTarget(notes, 4).label, 'Rest');
  assert.deepEqual(vocalStaffPosition(60), { step: -2, sharp: false });
  assert.deepEqual(vocalStaffPosition(61), { step: -2, sharp: true });
  assert.deepEqual(vocalStaffPosition(57), { step: -4, sharp: false });
});

test('vocal staff renders bounded pitch and hold cues at narrow and wide widths', () => {
  const labels = [], context = new Proxy({}, { get: (_object, key) => (...args) => {
    assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
    if (key === 'fillText') labels.push(args[0]);
  } });
  const chart = { beats: [{ time: 0, downbeat: true, bar: 1 }], notes: [{ pitch: 57, time: 1, duration: 1 }, { pitch: 61, time: 2.5, duration: 2 }] };
  for (const width of [280, 1000]) for (const time of [-1, 1, 3]) drawVocalStaff(context, width, 200, chart, time);
  assert.ok(labels.includes('A3')); assert.ok(labels.includes('C♯4')); assert.ok(labels.includes('♯'));
});
