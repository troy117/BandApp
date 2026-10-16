import { DRUMS, GROOVES, DEFAULT_BINDINGS, RESERVED_KEYS, keyLabel, validateBindings, assignBinding, createChart, activeDrums, beatAtTime, Judge, performanceCsv } from './engine.mjs';
import { KeyboardSource } from './vendor/sightkick-input.mjs';
import { DrumAudio } from './audio.mjs';
import { SongImporter, formatDuration } from './song-import.mjs';
import { backingSchedule } from './midi.mjs';

const $ = id => document.getElementById(id);
const audio = new DrumAudio();
const storageKey = 'sierra-groove-lab-v1';
let storageAvailable = true;
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { storageAvailable = false; }
let bindings = validateBindings(saved.bindings);
const validNumber = (value, fallback, min, max) => Number.isFinite(value) && value >= min && value <= max ? value : fallback;
let settings = {
  bpm: validNumber(saved.bpm, 80, 40, 160), bars: [4, 8, 16].includes(saved.bars) ? saved.bars : 4,
  grooveId: Object.hasOwn(GROOVES, saved.grooveId) ? saved.grooveId : 'rock',
  tolerance: [70, 100, 140].includes(saved.tolerance) ? saved.tolerance : 140,
  offset: validNumber(saved.offset, 0, -200, 200),
  metronome: saved.metronome !== false, guide: saved.guide === true,
};
let session = null;
let lastReport = null;
let capture = null;
let starting = false;
let generation = 0;
let lastStatsAt = 0;
let loadedSong = null;
let previewChart = createChart(settings.grooveId, settings.bpm, settings.bars);
let laneDrums = activeDrums(previewChart);
const importer = new SongImporter(audio, song => {
  stopRun();
  loadedSong = song;
  let option = $('groove').querySelector('option[value="imported"]');
  if (!option) { option = document.createElement('option'); option.value = 'imported'; $('groove').append(option); }
  option.textContent = `Imported · ${song.chart.title}`;
  settings.grooveId = 'imported';
  persist(); syncSettings();
  feedback('Your song is ready.', 'Listen first to check the drum part and backing alignment.');
  notify(song.backing && song.backing.offset + song.backing.buffer.duration < song.chart.duration - 0.5 ? 'The backing recording ends before the MIDI. Playback will continue through the remaining MIDI notes.' : '');
});
const flashes = new Map();
const padTimers = new Map();
const canvas = $('highway');
const ctx = canvas.getContext('2d');
let viewport = { width: 800, height: 347, dpr: 1 };

function notify(message, error = false) {
  $('notice').textContent = message;
  $('notice').hidden = !message;
  $('notice').classList.toggle('error', error);
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ ...settings, bindings })); }
  catch { storageAvailable = false; }
  $('storage-status').textContent = storageAvailable ? 'Controls saved on this device.' : 'Storage unavailable. Controls last for this visit.';
}
function feedback(title, detail, color = '#e8c17b') {
  $('feedback').innerHTML = `<span class="feedback-mark" aria-hidden="true" style="color:${color}">◎</span><div><strong></strong><span></span></div>`;
  $('feedback').querySelector('strong').textContent = title;
  $('feedback').querySelector(':scope > div > span').textContent = detail;
}
function renderPads() {
  $('drum-pads').innerHTML = DRUMS.map(drum => `<button class="drum-pad" data-drum="${drum.id}" style="--drum-color:${drum.color}" aria-label="Play ${drum.name}${bindings[drum.id].length ? `: ${bindings[drum.id].map(keyLabel).join(' or ')}` : ''}"><span class="pad-top"><span class="pad-name">${drum.name}</span><span class="pad-icon ${['hihat', 'crash', 'ride'].includes(drum.id) ? 'cymbal' : ''}" aria-hidden="true"></span></span><span class="pad-keys">${bindings[drum.id].map(code => `<kbd class="key-chip">${keyLabel(code)}</kbd>`).join('') || '<span class="unmapped">Unassigned</span>'}</span></button>`).join('');
  for (const button of $('drum-pads').querySelectorAll('button')) {
    button.addEventListener('pointerdown', event => { event.preventDefault(); strike(button.dataset.drum, performance.now(), 'pad'); });
    button.addEventListener('click', event => { if (event.detail === 0) strike(button.dataset.drum, performance.now(), 'pad'); });
  }
  renderLaneLabels();
}
function renderLaneLabels() {
  $('lane-labels').style.gridTemplateColumns = `repeat(${laneDrums.length}, minmax(0, 1fr))`;
  $('lane-labels').classList.toggle('many-lanes', laneDrums.length > 5);
  $('lane-labels').innerHTML = laneDrums.map(drum => `<div style="color:${drum.color}">${drum.short}<kbd>${bindings[drum.id].map(keyLabel).join(' / ') || '—'}</kbd></div>`).join('');
}
function renderGroove() {
  const imported = settings.grooveId === 'imported' && loadedSong;
  previewChart = imported ? loadedSong.chart : createChart(settings.grooveId, settings.bpm, settings.bars);
  laneDrums = activeDrums(previewChart);
  renderLaneLabels();
  $('time-signature').textContent = `${previewChart.numerator}/${previewChart.denominator}`;
  $('count-in-label').textContent = `${previewChart.countInBeats}-beat count-in`;
  $('bar-status').textContent = `${previewChart.bars} BARS · ${previewChart.notes.length} NOTES`;
  $('loaded-song').hidden = !imported;
  $('rhythm-grid').hidden = Boolean(imported);
  $('bars').hidden = Boolean(imported);
  $('song-duration').hidden = !imported;
  $('tempo-label').textContent = imported ? 'MIDI TEMPO' : 'TEMPO';
  $('length-label').textContent = imported ? 'DURATION' : 'LENGTH';
  $('bpm').value = imported ? Math.round(previewChart.bpm) : settings.bpm;
  $('bpm').disabled = Boolean(imported || session || starting);
  $('lesson-title').textContent = imported ? 'Play your own part.' : 'Keep it steady.';
  if (imported) {
    $('song-duration').textContent = formatDuration(previewChart.duration);
    $('loaded-song-info').textContent = loadedSong.backing ? `${loadedSong.backing.name} · offset ${loadedSong.backing.offset > 0 ? '+' : ''}${loadedSong.backing.offset}s` : 'MIDI loaded · no backing recording';
    $('groove-description').textContent = `${previewChart.notes.length} drum hits across ${previewChart.bars} bars. ${previewChart.tempoChanges ? `${previewChart.tempoChanges} tempo change${previewChart.tempoChanges === 1 ? '' : 's'} preserved.` : 'The original MIDI tempo is preserved.'}${previewChart.ignored ? ` ${previewChart.ignored} unmapped or ignored notes are excluded.` : ''}`;
    $('lesson-tip').textContent = 'Use Song setup to adjust the drum assignments or backing alignment. Files stay on this device.';
    return;
  }
  $('lesson-tip').innerHTML = 'Try counting <strong>“1 & 2 & 3 & 4 &”</strong> out loud.';
  $('groove-description').textContent = GROOVES[settings.grooveId].description;
  const pattern = GROOVES[settings.grooveId];
  $('rhythm-grid').innerHTML = '<span></span>' + ['1', '&', '2', '&', '3', '&', '4', '&'].map(beat => `<span>${beat}</span>`).join('') + ['hihat', 'snare', 'kick'].map(id => {
    const drum = DRUMS.find(drum => drum.id === id);
    return `<span class="grid-label">${id === 'hihat' ? 'HAT' : drum.short}</span>` + Array.from({ length: 8 }, (_, step) => `<div class="grid-dot ${pattern[id].includes(step) ? 'active' : ''}" style="--drum-color:${drum.color}" aria-label="${drum.name} ${step / 2 + 1}${pattern[id].includes(step) ? ': hit' : ': rest'}"></div>`).join('');
  }).join('');
}
function syncSettings() {
  $('bpm').value = settings.bpm;
  $('bars').value = settings.bars;
  $('groove').value = settings.grooveId;
  $('tolerance').value = settings.tolerance;
  $('offset').value = settings.offset;
  $('offset-value').textContent = `${settings.offset} ms`;
  $('metronome').checked = settings.metronome;
  $('guide').checked = settings.guide;
  renderGroove();
}
function renderMappings() {
  $('mapping-list').innerHTML = DRUMS.map(drum => `<div class="mapping-row ${capture?.drum === drum.id ? 'capturing' : ''}" data-drum="${drum.id}"><span class="mapping-drum"><i class="drum-dot" style="--drum-color:${drum.color}"></i>${drum.name}</span><span class="mapping-keys">${bindings[drum.id].map(code => `<span class="key-chip">${keyLabel(code)}<button class="clear-key" data-remove="${code}" data-drum="${drum.id}" aria-label="Remove ${keyLabel(code)} from ${drum.name}">×</button></span>`).join('') || '<span class="unmapped">No key</span>'}</span><button class="button quiet" data-map="${drum.id}" aria-label="Change ${drum.name} key">${capture?.drum === drum.id && !capture.additional ? 'Press a key…' : 'Change'}</button><button class="button quiet" data-add="${drum.id}" aria-label="Add alternate ${drum.name} key">+ Key</button></div>`).join('');
}
function setLocked(locked) {
  for (const id of ['groove', 'bpm', 'bars', 'metronome', 'guide']) $(id).disabled = locked || (id === 'bpm' && settings.grooveId === 'imported');
  $('view-report').disabled = locked || !lastReport;
}
function elapsed() { return session ? audio.audibleTime() - session.startAt : 0; }
async function startRun(mode = 'practice') {
  if (session || starting) { stopRun(); return; }
  const enteredBpm = Number($('bpm').value);
  if (settings.grooveId !== 'imported' && (!$('bpm').value || !Number.isFinite(enteredBpm) || enteredBpm < 40 || enteredBpm > 160)) {
    notify('Choose a tempo between 40 and 160 BPM.');
    $('bpm').focus();
    return;
  }
  if (settings.grooveId !== 'imported') settings.bpm = Math.round(enteredBpm);
  renderGroove();
  persist();
  starting = true;
  const myGeneration = ++generation;
  $('start').disabled = true;
  $('listen').disabled = true;
  setLocked(true);
  notify('');
  try {
    await audio.ready();
    if (myGeneration !== generation) return;
    const chart = previewChart;
    const beat = chart.countInBeatSeconds;
    session = { mode, judge: new Judge(chart, settings.tolerance), startAt: audio.context.currentTime + 0.18 + chart.countInBeats * beat, scheduledBeat: 0, scheduledCount: 0, scheduledNote: 0, settings: { ...settings }, backing: settings.grooveId === 'imported' ? loadedSong.backing : null, lastCount: null };
    if (session.backing) {
      const timing = backingSchedule(session.startAt, session.backing.offset, session.backing.buffer.duration);
      audio.playBacking(session.backing.buffer, timing.when, timing.offset, session.backing.volume);
    }
    flashes.clear();
    $('start').innerHTML = '<span aria-hidden="true">■</span> Stop groove <kbd>Esc</kbd>';
    $('listen').innerHTML = mode === 'demo' ? '♫ Listening…' : '<span aria-hidden="true">♫</span> Listen first';
    $('listen').disabled = true;
    $('start').disabled = false;
    $('session-chip').textContent = 'Count-in';
    $('live-score').textContent = '—';
    $('live-hits').textContent = '0';
    $('live-streak').textContent = '0';
    feedback(mode === 'demo' ? 'Listen to the pattern.' : 'Here comes the count-in.', mode === 'demo' ? 'No score in listen mode. Play along if you like.' : 'Meet each colored bar at the line.');
    schedule();
  } catch (error) {
    session = null;
    audio.silence();
    notify(error.message || 'Audio could not start. Try Chrome and click Start groove again.', true);
    resetTransport();
  } finally {
    starting = false;
    if (!session) resetTransport();
  }
}
function resetTransport() {
  $('start').disabled = false;
  $('listen').disabled = false;
  $('start').innerHTML = '<span aria-hidden="true">▶</span> Start groove <kbd>Enter</kbd>';
  $('listen').innerHTML = '<span aria-hidden="true">♫</span> Listen first';
  setLocked(false);
  $('play-state').textContent = 'PRACTICE AT YOUR PACE';
  $('stage-overlay').className = 'stage-overlay';
  $('stage-overlay').hidden = false;
  $('stage-overlay').innerHTML = '<span class="eyebrow">TAKE YOUR TIME</span><strong>Ready when you are.</strong><span>Listen first, or jump right in.</span>';
  renderGroove();
}
function stopRun(message = 'Run stopped. Start again whenever you’re ready.') {
  generation++;
  starting = false;
  const wasActive = Boolean(session);
  session = null;
  audio.silence();
  resetTransport();
  $('session-chip').textContent = 'Ready';
  if (wasActive) feedback('Take a breath.', message);
}
function finishRun() {
  const finished = session;
  if (!finished) return;
  if (finished.mode === 'practice') {
    finished.judge.advance(Infinity);
    lastReport = { ...finished, backing: finished.backing ? { name: finished.backing.name, offset: finished.backing.offset, volume: finished.backing.volume } : null };
  }
  session = null;
  audio.silence();
  resetTransport();
  $('session-chip').textContent = finished.mode === 'demo' ? 'Ready' : 'Complete';
  if (finished.mode === 'demo') feedback('Now it’s your turn.', 'Press Start groove to try the pattern yourself.');
  else {
    updateStats(finished.judge);
    feedback('That’s a full run.', 'Your report shows where each hit landed.');
    showReport();
  }
}
function schedule() {
  if (!session || !audio.context) return;
  const { startAt, judge, settings: runSettings, mode } = session;
  const horizon = audio.context.currentTime + 0.12;
  while (session.scheduledCount < judge.chart.countInBeats) {
    const index = session.scheduledCount;
    const at = startAt + (index - judge.chart.countInBeats) * judge.chart.countInBeatSeconds;
    if (at > horizon) break;
    if (at >= audio.context.currentTime - 0.025) audio.click(at, index === 0);
    session.scheduledCount++;
  }
  while (session.scheduledBeat < judge.chart.beats.length) {
    const beat = judge.chart.beats[session.scheduledBeat];
    const at = startAt + beat.time;
    if (at > horizon) break;
    if (runSettings.metronome && at >= audio.context.currentTime - 0.025) audio.click(at, beat.downbeat);
    session.scheduledBeat++;
  }
  while (session.scheduledNote < judge.chart.notes.length) {
    const note = judge.chart.notes[session.scheduledNote];
    const at = startAt + note.time;
    if (at > horizon) break;
    if ((mode === 'demo' || runSettings.guide) && at >= audio.context.currentTime - 0.025) audio.play(note.drum, at, 0.65 * (note.velocity ?? 1));
    session.scheduledNote++;
  }
}
setInterval(schedule, 25);
function flashDrum(id) {
  flashes.set(id, performance.now());
  const pad = document.querySelector(`.drum-pad[data-drum="${id}"]`);
  if (!pad) return;
  pad.classList.add('flash');
  clearTimeout(padTimers.get(id));
  padTimers.set(id, setTimeout(() => pad.classList.remove('flash'), 130));
}
function strike(drum, timestamp, source = 'keyboard') {
  flashDrum(drum);
  const normalizedTimestamp = timestamp > 1e12 ? timestamp - performance.timeOrigin : timestamp;
  if (!audio.context || audio.context.state !== 'running') {
    audio.ready().then(() => audio.play(drum)).catch(error => notify(error.message, true));
    return;
  }
  audio.play(drum);
  if (!session || session.mode !== 'practice') return;
  const time = audio.audibleTime(normalizedTimestamp) - session.startAt - session.settings.offset / 1000;
  if (time < -session.settings.tolerance / 1000 || time > session.judge.chart.duration + session.settings.tolerance / 1000) return;
  const result = session.judge.strike(drum, time, source);
  if (result.type === 'extra') feedback('An extra hit.', 'Keep following the colored bars.', '#f58c99');
  else {
    const ms = Math.round(Math.abs(result.errorMs));
    const name = DRUMS.find(item => item.id === drum).name;
    const title = ms <= 25 ? 'Right in the pocket.' : `${ms} ms ${result.errorMs < 0 ? 'early' : 'late'}.`;
    feedback(title, `${name} · ${ms <= 25 ? 'Keep that feeling.' : result.errorMs < 0 ? 'Give the beat a little room.' : 'Try meeting the line a little sooner.'}`, ms <= 50 ? '#63d9c4' : '#e8c17b');
  }
  updateStats(session.judge);
}
function updateStats(judge) {
  const score = judge.summary();
  const judged = score.hits + score.misses + score.extras;
  $('live-score').textContent = judged ? `${Math.round(score.hits / judged * 100)}%` : '—';
  $('live-hits').textContent = score.hits;
  $('live-streak').textContent = score.bestStreak;
}

// Timestamped input goes to the judge; animation frames only draw the view.
new KeyboardSource().start(event => {
  if (document.querySelector('dialog[open]')) return;
  const code = event.controlId.slice('keyboard:'.length);
  if (code === 'Escape') { if (session || starting) { event.nativeEvent.preventDefault(); stopRun(); } return; }
  if (code === 'Enter') {
    if (event.nativeEvent.target.closest?.('button, a')) return;
    event.nativeEvent.preventDefault();
    startRun();
    return;
  }
  const drum = DRUMS.find(drum => bindings[drum.id].includes(code));
  if (!drum) return;
  event.nativeEvent.preventDefault();
  strike(drum.id, event.timestamp);
});
document.addEventListener('keydown', event => {
  if (!capture || !$('settings-dialog').open) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.code === 'Escape') {
    capture = null;
    $('mapping-status').textContent = 'Assignment cancelled. Your controls are unchanged.';
    renderMappings();
    return;
  }
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || RESERVED_KEYS.has(event.code)) {
    $('mapping-status').textContent = 'Choose a letter, number, Space, or punctuation key. Esc cancels.';
    return;
  }
  const result = assignBinding(bindings, capture.drum, event.code, capture.additional);
  if (!result.ok) { $('mapping-status').textContent = result.reason; return; }
  const name = DRUMS.find(drum => drum.id === capture.drum).name;
  bindings = result.bindings;
  capture = null;
  persist();
  renderMappings();
  renderPads();
  $('mapping-status').textContent = `${name} assigned to ${keyLabel(event.code)}. Saved${storageAvailable ? ' on this device' : ' for this visit'}.`;
}, true);

function openSettings() {
  if (session || starting) stopRun('Controls opened. Start a fresh run after changing settings.');
  capture = null;
  renderMappings();
  $('mapping-status').textContent = 'Changes save automatically on this device.';
  $('settings-dialog').showModal();
}
for (const id of ['open-settings', 'edit-controls']) $(id).addEventListener('click', openSettings);
$('mapping-list').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.remove) {
    bindings[button.dataset.drum] = bindings[button.dataset.drum].filter(code => code !== button.dataset.remove);
    capture = null;
    persist(); renderPads(); renderMappings();
    $('mapping-status').textContent = 'Key removed. Choose Change or + Key to assign a new one.';
  } else {
    capture = { drum: button.dataset.map || button.dataset.add, additional: Boolean(button.dataset.add) };
    renderMappings();
    $('mapping-status').textContent = `Press a key for ${DRUMS.find(drum => drum.id === capture.drum).name}. Esc cancels.`;
  }
});
$('settings-dialog').addEventListener('close', () => { capture = null; });
$('reset-controls').addEventListener('click', () => { bindings = structuredClone(DEFAULT_BINDINGS); capture = null; persist(); renderPads(); renderMappings(); $('mapping-status').textContent = 'Default keyboard controls restored.'; });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
$('about').addEventListener('click', () => { if (session || starting) stopRun(); $('about-dialog').showModal(); });
$('start').addEventListener('click', () => startRun());
$('listen').addEventListener('click', () => startRun('demo'));
for (const id of ['open-import', 'song-setup']) $(id).addEventListener('click', () => { if (session || starting) stopRun('Song setup opened. Start a fresh run when you’re ready.'); importer.open(); });
$('open-library').addEventListener('click', () => { if (session || starting) stopRun('Song library opened. Start a fresh run when you’re ready.'); importer.openLibrary(); });
$('clear-song').addEventListener('click', () => { stopRun(); loadedSong = null; importer.applied = null; importer.draft = null; importer.token++; $('groove').querySelector('option[value="imported"]')?.remove(); settings.grooveId = 'rock'; persist(); syncSettings(); notify(''); feedback('Back to the practice room.', 'Your keyboard controls are unchanged.'); });
for (const [id, field] of [['groove', 'grooveId'], ['bars', 'bars'], ['bpm', 'bpm'], ['tolerance', 'tolerance'], ['offset', 'offset'], ['guide', 'guide'], ['metronome', 'metronome']]) {
  $(id).addEventListener(id === 'offset' ? 'input' : 'change', () => {
    if (session) return;
    const element = $(id);
    let value = element.type === 'checkbox' ? element.checked : field === 'grooveId' ? element.value : Number(element.value);
    if (field === 'bpm' && (!element.value || !Number.isFinite(value) || value < 40 || value > 160)) {
      element.value = settings.bpm;
      notify('Choose a tempo between 40 and 160 BPM.');
      return;
    }
    if (field === 'bpm') value = Math.round(value);
    settings[field] = value;
    persist(); syncSettings();
  });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && (session || starting)) stopRun('The run stopped while this tab was hidden. Your next run will start fresh.'); });
window.addEventListener('blur', () => { if (session || starting) { stopRun('The run stopped when the window lost focus. Start again when you’re ready.'); } });

function resize() {
  const rect = canvas.getBoundingClientRect();
  viewport = { width: rect.width, height: rect.height, dpr: Math.min(devicePixelRatio || 1, 2) };
  canvas.width = Math.round(rect.width * viewport.dpr);
  canvas.height = Math.round(rect.height * viewport.dpr);
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
function drawHighway(time) {
  const { width: w, height: h } = viewport;
  ctx.clearRect(0, 0, w, h);
  const top = 42, target = h - 73, bottom = h - 52;
  const nearWidth = w * 0.8, farWidth = w * 0.32;
  const at = depth => ({ y: top + (target - top) * depth ** 1.55, left: (w - (farWidth + (nearWidth - farWidth) * depth)) / 2, width: farWidth + (nearWidth - farWidth) * depth });
  const far = at(0), near = at(1);
  ctx.beginPath(); ctx.moveTo(far.left, top); ctx.lineTo(far.left + far.width, top); ctx.lineTo(near.left + near.width, bottom); ctx.lineTo(near.left, bottom); ctx.closePath();
  const grad = ctx.createLinearGradient(0, top, 0, bottom); grad.addColorStop(0, '#18282b'); grad.addColorStop(1, '#1c2b2f'); ctx.fillStyle = grad; ctx.fill();
  const chart = session?.judge.chart || previewChart;
  const lanes = laneDrums.length;
  for (let lane = 0; lane <= lanes; lane++) {
    ctx.beginPath(); ctx.moveTo(far.left + far.width * lane / lanes, top); ctx.lineTo(near.left + near.width * lane / lanes, bottom);
    ctx.strokeStyle = lane === 0 || lane === lanes ? '#40555766' : '#344a4d66'; ctx.lineWidth = 1; ctx.stroke();
  }
  const lookahead = 3.3;
  const visibleTime = session ? time : -0.4;
  const drawingBeats = [...Array.from({ length: chart.countInBeats }, (_, i) => ({ time: (i - chart.countInBeats) * chart.countInBeatSeconds, downbeat: i === 0, bar: 0 })), ...chart.beats];
  for (const beat of drawingBeats) {
    const delta = beat.time - visibleTime;
    if (delta < 0 || delta > lookahead) continue;
    const p = at(1 - delta / lookahead);
    ctx.beginPath(); ctx.moveTo(p.left, p.y); ctx.lineTo(p.left + p.width, p.y); ctx.strokeStyle = beat.downbeat ? '#627b7c55' : '#3e5a5d55'; ctx.lineWidth = 1; ctx.stroke();
    if (beat.bar > 0 && beat.downbeat) { ctx.font = '8px Segoe UI, sans-serif'; ctx.fillStyle = '#6f898b'; ctx.fillText(String(beat.bar).padStart(2, '0'), p.left - 21, p.y + 3); }
  }
  for (let i = chart.notes.length - 1; i >= 0; i--) {
    const note = chart.notes[i];
    const delta = note.time - visibleTime;
    if (delta < -0.12 || delta > lookahead || note.status === 'hit') continue;
    const drum = DRUMS.find(drum => drum.id === note.drum);
    const lane = laneDrums.indexOf(drum);
    const depth = Math.min(1.06, 1 - delta / lookahead);
    const p = at(depth);
    const noteWidth = p.width / lanes * 0.74;
    const x = p.left + p.width / lanes * (lane + 0.5) - noteWidth / 2;
    ctx.globalAlpha = note.status === 'miss' ? 0.25 : Math.min(1, 0.28 + depth);
    ctx.shadowColor = drum.color; ctx.shadowBlur = 10 * depth;
    ctx.fillStyle = drum.color;
    ctx.beginPath(); ctx.roundRect(x, p.y - (3 + depth * 3), noteWidth, 4 + depth * 7, 2 + depth * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(x + 3, p.y - (2 + depth * 3), noteWidth - 6, 1);
    ctx.globalAlpha = 1;
  }
  for (let lane = 0; lane < lanes; lane++) {
    const drum = laneDrums[lane];
    const age = performance.now() - (flashes.get(drum.id) || 0);
    const x = near.left + near.width * lane / lanes;
    if (age < 200) {
      const glow = ctx.createLinearGradient(0, target - 85, 0, target); glow.addColorStop(0, drum.color + '00'); glow.addColorStop(1, drum.color + '33');
      ctx.fillStyle = glow; ctx.fillRect(x + 1, target - 85, near.width / lanes - 2, 90);
    }
    ctx.strokeStyle = age < 160 ? drum.color : drum.color + '88'; ctx.lineWidth = age < 160 ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(x + 4, target); ctx.lineTo(x + near.width / lanes - 4, target); ctx.stroke();
  }
  const fade = ctx.createLinearGradient(0, 0, 0, 77); fade.addColorStop(0, '#111b1eff'); fade.addColorStop(1, '#111b1e00'); ctx.fillStyle = fade; ctx.fillRect(0, 0, w, 77);
}
function frame() {
  const time = elapsed();
  if (session) {
    const chart = session.judge.chart;
    const beatLength = chart.countInBeatSeconds;
    if (time < 0) {
      const count = Math.max(1, Math.min(chart.countInBeats, chart.countInBeats + 1 + Math.floor(time / beatLength)));
      if (count !== session.lastCount) {
        $('stage-overlay').hidden = false;
        $('stage-overlay').className = 'stage-overlay counting';
        $('stage-overlay').innerHTML = `<span class="eyebrow">COUNT YOURSELF IN</span><strong>${count}</strong><span>${chart.countInBeats} beats · ${chart.numerator}/${chart.denominator}</span>`;
        session.lastCount = count;
      }
    } else {
      $('stage-overlay').hidden = true;
      $('session-chip').textContent = session.mode === 'demo' ? 'Listening' : 'Playing';
      $('play-state').textContent = session.mode === 'demo' ? 'LISTEN MODE · NO SCORING' : 'MEET THE NOTES AT THE LINE';
      const position = beatAtTime(chart, time);
      $('bar-status').textContent = `BAR ${position.bar} / ${chart.bars}${chart.kind === 'midi' ? ` · ${formatDuration(Math.max(0, time))} / ${formatDuration(chart.duration)}` : ''}`;
      if (chart.kind === 'midi') {
        const tempo = chart.tempos.findLast(item => item.time <= time) || chart.tempos[0];
        const signature = chart.signatures.findLast(item => item.time <= time) || chart.signatures[0];
        $('bpm').value = Math.round(tempo.bpm);
        $('time-signature').textContent = `${signature.numerator}/${signature.denominator}`;
      }
    }
    if (session.mode === 'practice') {
      session.judge.advance(time - session.settings.offset / 1000);
      if (performance.now() - lastStatsAt > 90) { updateStats(session.judge); lastStatsAt = performance.now(); }
    }
    if (time > session.judge.chart.duration + 0.35) finishRun();
  }
  drawHighway(time);
  requestAnimationFrame(frame);
}

function timingText(value) {
  if (value === null) return '—';
  const rounded = Math.round(value);
  if (Math.abs(rounded) <= 5) return 'On time';
  return `${Math.abs(rounded)} ms ${rounded < 0 ? 'early' : 'late'}`;
}
function showReport() {
  if (!lastReport) return;
  const { judge, settings: runSettings } = lastReport;
  const score = judge.summary();
  $('report-subtitle').textContent = `${judge.chart.title} · ${Math.round(judge.chart.bpm)} BPM${judge.chart.tempoChanges ? ' with tempo changes' : ''} · ${judge.chart.bars} bars · ±${runSettings.tolerance} ms window · ${runSettings.offset} ms input correction${lastReport.backing ? ` · ${lastReport.backing.offset}s audio offset` : ''}`;
  $('report-stats').innerHTML = [
    [Math.round(score.accuracy) + '%', 'match rate'], [`${score.hits} / ${score.total}`, 'notes matched'],
    [String(score.misses), 'missed notes'], [String(score.extras), 'extra hits'],
  ].map(([value, label]) => `<div class="report-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('report-drums').innerHTML = score.byDrum.map(drum => `<tr><td><i class="drum-dot" style="--drum-color:${drum.color}"></i>${drum.name}</td><td>${drum.hits} / ${drum.total}</td><td>${timingText(drum.meanMs)}</td><td>${drum.meanAbsMs === null ? '—' : Math.round(drum.meanAbsMs) + ' ms'}</td></tr>`).join('');
  $('report-advice').textContent = !score.hits ? 'No matched hits yet. Try Listen first and focus on one drum at a time. Your first full run is a useful starting point.' : `Your typical timing error was ${Math.round(score.meanAbsMs)} ms; your average tendency was ${timingText(score.meanMs).toLowerCase()}. ${score.accuracy >= 85 ? 'A steady run. Try the next timing window when you feel comfortable.' : judge.chart.kind === 'midi' ? 'Check the song assignments, then focus on a steady pattern.' : 'Try a slower tempo and aim for a steady pattern before increasing speed.'}`;
  $('report-dialog').showModal();
  requestAnimationFrame(drawTimingChart);
}
function drawTimingChart() {
  const plot = $('timing-chart');
  const rect = plot.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  plot.width = rect.width * dpr; plot.height = rect.height * dpr;
  const c = plot.getContext('2d'); c.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  const pad = { left: 41, right: 16, top: 20, bottom: 26 };
  const tolerance = lastReport.settings.tolerance;
  const mid = (h - pad.bottom + pad.top) / 2;
  c.font = '8px Segoe UI, sans-serif';
  for (const value of [-tolerance, 0, tolerance]) {
    const y = mid + value / tolerance * (h - pad.top - pad.bottom) / 2;
    c.strokeStyle = value === 0 ? '#779b7955' : '#304a3e';
    c.setLineDash(value === 0 ? [] : [3, 4]); c.beginPath(); c.moveTo(pad.left, y); c.lineTo(w - pad.right, y); c.stroke();
    c.fillStyle = '#87a58b'; c.fillText(value > 0 ? `+${value}` : String(value), 8, y + 3);
  }
  c.setLineDash([]);
  const hits = lastReport.judge.chart.notes.filter(note => note.status === 'hit');
  for (const note of hits) {
    c.fillStyle = DRUMS.find(drum => drum.id === note.drum).color;
    const x = pad.left + note.time / lastReport.judge.chart.duration * (w - pad.left - pad.right);
    const y = mid + note.errorMs / tolerance * (h - pad.top - pad.bottom) / 2;
    c.beginPath(); c.arc(x, y, 3.3, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#87a58b'; c.fillText('START', pad.left, h - 9); c.fillText('END', w - 34, h - 9); c.fillText('ms', 8, 10);
  if (!hits.length) { c.fillStyle = '#92ad98'; c.font = '11px Segoe UI, sans-serif'; c.textAlign = 'center'; c.fillText('Matched hits will appear here.', w / 2 + 10, mid - 10); }
}
$('view-report').addEventListener('click', showReport);
$('try-again').addEventListener('click', () => { $('report-dialog').close(); startRun(); });
$('download-report').addEventListener('click', () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([performanceCsv(lastReport.judge)], { type: 'text/csv;charset=utf-8' }));
  const title = lastReport.judge.chart.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 70);
  const link = document.createElement('a'); link.href = url; link.download = `groove-lab-${title}-${Math.round(lastReport.judge.chart.bpm)}bpm.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('resize', () => { if ($('report-dialog').open) drawTimingChart(); });
syncSettings(); renderPads(); persist(); resize(); requestAnimationFrame(frame);
