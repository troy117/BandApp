import test from 'node:test';
import assert from 'node:assert/strict';
import { createChart, GROOVES, Judge } from '../dist/engine.mjs';
import { createNotation, scoreBeatAtTime } from '../dist/notation.mjs';
import { fullScoreLayout, fullScoreRow, fullScoreX, FullScoreView } from '../dist/full-score.mjs';
import { createPracticeChart } from '../dist/practice.mjs';
import { parseMidiSong, makeMidiChart, buildTimeline } from '../dist/midi.mjs';
import { createDemoMidi, createDemoWav } from '../dist/demo-data.mjs';
import { alignMidiChart } from '../dist/sync.mjs';
import { SongImporter } from '../dist/song-import.mjs';

test('full scores retain all built-in notes, rests and bars across row widths without changing the chart', () => {
  for (const id of Object.keys(GROOVES)) {
    const chart = createPracticeChart(createChart(id, 100, 16)), before = structuredClone(chart), notation = createNotation(chart);
    for (const width of [290, 390, 800, 1150]) {
      const layout = fullScoreLayout(notation, width);
      assert.deepEqual(layout.rows.flatMap(row => row.notation.measures.map(measure => measure.bar)), notation.measures.map(measure => measure.bar));
      assert.deepEqual(layout.rows.flatMap(row => row.notation.groups.flatMap(group => group.notes.map(note => note.id))), chart.notes.map(note => note.id));
      assert.equal(layout.rows.flatMap(row => row.notation.groups).length, notation.groups.length);
      for (const row of layout.rows) for (const group of row.notation.groups) {
        const x = fullScoreX(row, group.beat);
        assert.ok(x >= layout.gutter && x <= layout.right);
        assert.equal(fullScoreRow(layout, group.beat), row);
      }
      assert.equal(fullScoreRow(layout, -4), layout.rows[0]);
      assert.equal(fullScoreRow(layout, notation.totalBeats + 1), layout.rows.at(-1));
    }
    assert.deepEqual(chart, before);
  }
});

test('full-score playback follows later rows while canvas allocation remains bounded to the visible page', () => {
  const chart = createPracticeChart(createChart('rock', 100, 16)), notation = createNotation(chart);
  const page = { style: {} }, context = new Proxy({}, { get: () => () => {} });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => context, setAttribute() {} };
  const container = { clientWidth: 800, clientHeight: 340, scrollTop: 0, dataset: {}, parentElement: { style: { setProperty() {} } } };
  const view = new FullScoreView(container, page, canvas);
  view.draw(notation, chart, 0, true, false);
  assert.equal(container.scrollTop, 0); assert.equal(container.dataset.activeRow, '1');
  const last = view.layout.rows.at(-1), time = last.notation.measures[0].time;
  view.draw(notation, chart, time, true, false);
  assert.equal(container.dataset.activeRow, String(view.layout.rows.length)); assert.ok(container.scrollTop > 0);
  assert.equal(canvas.width, 800); assert.equal(canvas.height, 340); assert.ok(parseInt(page.style.height) > canvas.height);
  const manualScroll = container.scrollTop - 20; container.scrollTop = manualScroll;
  view.draw(notation, chart, time + 0.05, true, false); assert.equal(container.scrollTop, manualScroll);
});

test('fullscreen row spacing fits more music while preserving notes, cursor positions and count labels', () => {
  const chart = createPracticeChart(createChart('rock', 100, 16)), notation = createNotation(chart);
  const normal = fullScoreLayout(notation, 1200), compact = fullScoreLayout(notation, 1200, { compact: true });
  assert.ok(compact.rowHeight < normal.rowHeight);
  assert.ok(compact.staffTop + 4 * compact.lineGap + compact.countOffset < compact.rowHeight - 28);
  assert.deepEqual(compact.rows.flatMap(row => row.notation.groups.flatMap(group => group.notes)), chart.notes);
  for (const note of chart.notes) {
    const beat = note.quarter ?? (note.bar - 1) * 4 + note.beat - 1;
    assert.equal(fullScoreX(fullScoreRow(compact, beat), beat), fullScoreX(fullScoreRow(normal, beat), beat));
  }
});

test('full-score cursor crosses rows on the MIDI clock through retimed tempos, focused repeats and partial meters', () => {
  const song = parseMidiSong(createDemoMidi()), source = alignMidiChart(makeMidiChart(song, song.selected), 1.04);
  const loop = createPracticeChart(source, { enabled: true, startBar: 2, endBar: 4, repeats: 4, focus: 'kick' });
  const notation = createNotation(loop), layout = fullScoreLayout(notation, 390);
  assert.deepEqual(layout.rows.flatMap(row => row.notation.measures.map(m => [m.sourceBar, m.pass])), notation.measures.map(m => [m.sourceBar, m.pass]));
  for (const note of loop.notes) {
    const beat = scoreBeatAtTime(notation, note.time), row = fullScoreRow(layout, beat);
    assert.ok(Math.abs(fullScoreX(row, beat) - fullScoreX(row, note.quarter)) < 1e-7);
    assert.ok(row.notation.groups.some(group => group.notes.some(hit => hit.id === note.id)));
  }
  const timeline = buildTimeline(480, [], [{ tick: 1920, numerator: 6, denominator: 8 }]);
  const varied = makeMidiChart({ title: 'Meters', ppq: 480, endTick: 2640, timeline, parts: [{ id: '0:9', notes: [0, 160, 320, 1920, 2400].map(tick => ({ tick, pitch: 36, velocity: 100 })) }] }, ['0:9']);
  const variedScore = createNotation(varied), wrapped = fullScoreLayout(variedScore, 390);
  assert.deepEqual(wrapped.rows.flatMap(row => row.notation.measures), variedScore.measures);
  assert.ok(variedScore.groups.some(group => group.tuplet));
  assert.equal(wrapped.rows.at(-1).end, variedScore.totalBeats);
  const judge = new Judge(loop);
  for (const note of loop.notes) judge.strike(note.drum, note.time);
  assert.equal(judge.summary().hits, loop.notes.length);
});

// Exercise real import/apply logic with only the UI and audio decoder substituted.
function importerFixture() {
  const elements = new Map(), calls = { applied: [], setupOpened: 0, libraryClosed: 0 };
  const importer = Object.create(SongImporter.prototype);
  importer.el = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', open: id === 'library-dialog', classList: { toggle() {} }, querySelectorAll: () => [], close() { this.open = false; if (id === 'library-dialog') calls.libraryClosed++; } });
    return elements.get(id);
  };
  importer.dialog = { close() {}, showModal() { calls.setupOpened++; } };
  importer.sync = { reset() {}, draw() {} }; importer.render = () => {};
  importer.audio = { decodeBacking: async () => ({ duration: 8.8 }) };
  importer.libraryToken = 0; importer.token = 0;
  importer.onApply = song => calls.applied.push(song);
  return { importer, calls };
}

test('device library songs open ready to play with saved sync/mapping/audio and no settings dialog', async () => {
  const { importer, calls } = importerFixture();
  const midiBytes = createDemoMidi(), parsed = parseMidiSong(midiBytes);
  importer.library = { get: async () => ({ midiBytes, audioBytes: createDemoWav(), fileName: 'saved.mid', audioName: 'saved.wav', selected: parsed.selected, mapping: { 36: 'snare' }, offset: -0.125, timeScale: 1.02, volume: 0.4 }) };
  await importer.loadSavedSong('device-song');
  assert.equal(calls.applied.length, 1); assert.equal(calls.setupOpened, 0); assert.equal(calls.libraryClosed, 1);
  const song = calls.applied[0];
  assert.equal(song.backing.offset, -0.125); assert.equal(song.backing.volume, 0.4); assert.equal(song.chart.timeScale, 1.02);
  assert.equal(song.chart.notes.filter(note => note.drum === 'kick').length, 0);
  importer.setPlaybackVolume(0.2); assert.equal(importer.applied.volume, 0.2); assert.equal(importer.draft.volume, 0.2);
});

test('school library songs open directly for both teachers and students with the published title and settings', async () => {
  for (const staff of [false, true]) {
    const { importer, calls } = importerFixture(), midiBytes = createDemoMidi(), parsed = parseMidiSong(midiBytes);
    const metadata = { title: 'Prepared class song', fileName: 'school.mid', audioName: 'school.wav', selected: parsed.selected, mapping: {}, offset: 0.25, timeScale: 1, volume: 0.55, revisionId: 'revision', canManage: staff };
    importer.school = { staff, schoolId: 'school', request: async () => ({ song: metadata }), download: async route => route.endsWith('/midi') ? midiBytes : createDemoWav() };
    await importer.loadSchoolSong('song');
    assert.equal(calls.applied.length, 1); assert.equal(calls.setupOpened, 0); assert.equal(calls.libraryClosed, 1);
    assert.equal(calls.applied[0].chart.title, metadata.title); assert.equal(calls.applied[0].backing.offset, 0.25);
    assert.equal(calls.applied[0].backing.volume, 0.55); assert.equal(calls.applied[0].schoolSource.songId, 'song');
  }
});

test('invalid saved songs leave the library open with an actionable error and no partially applied song', async () => {
  const { importer, calls } = importerFixture();
  const midiBytes = createDemoMidi(), parsed = parseMidiSong(midiBytes);
  importer.library = { get: async () => ({ midiBytes, fileName: 'invalid.mid', selected: parsed.selected, mapping: {}, offset: 999, volume: 0.65 }) };
  await importer.loadSavedSong('invalid');
  assert.equal(calls.applied.length, 0); assert.equal(calls.libraryClosed, 0);
  assert.match(importer.el('library-status').textContent, /offset/i);
  assert.equal(importer.libraryBusy, false); assert.equal(importer.el('show-archived').disabled, false);
});
