import { GROOVES } from './engine.mjs';
import { LEVELS } from './lessons.mjs';
import { FOCUS_OPTIONS, createPracticeChart, savePracticeHistory } from './practice.mjs';
import { escapeHtml, formatDuration } from './song-import.mjs';

export class PracticeTools {
  constructor(onChange, onChoose) {
    this.el = id => document.getElementById(id);
    this.onChange = onChange; this.onChoose = onChoose;
    this.key = null; this.level = 0; this.valid = true;
    let stored = {}, history = [];
    try { stored = JSON.parse(localStorage.getItem('groove-lab-practice-v1') || '{}') || {}; } catch { /* Defaults remain available. */ }
    try { history = JSON.parse(localStorage.getItem('groove-lab-history-v1') || '[]'); } catch { /* History is optional. */ }
    this.storedKey = stored.key;
    this.options = { enabled: stored.enabled === true, startBar: Number.isInteger(stored.startBar) ? stored.startBar : 1, endBar: Number.isInteger(stored.endBar) ? stored.endBar : 4, repeats: [1, 2, 4, 8].includes(stored.repeats) ? stored.repeats : 4, stepUp: stored.stepUp === true, focus: Object.hasOwn(FOCUS_OPTIONS, stored.focus) ? stored.focus : 'all' };
    this.history = Array.isArray(history) ? history.filter(item => item && typeof item.title === 'string' && Number.isFinite(item.at) && Number.isFinite(item.accuracy)).slice(0, 30) : [];
    this.el('practice-focus').innerHTML = Object.entries(FOCUS_OPTIONS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
    for (const [id, field] of [['loop-enabled', 'enabled'], ['loop-from', 'startBar'], ['loop-to', 'endBar'], ['loop-repeats', 'repeats'], ['tempo-step', 'stepUp'], ['practice-focus', 'focus']]) {
      this.el(id).addEventListener('change', () => {
        const input = this.el(id);
        if (input.type === 'number' && (!input.value || !Number.isInteger(Number(input.value)) || Number(input.value) < 1 || Number(input.value) > this.source.bars)) {
          input.value = this.options[field]; this.el('practice-summary').textContent = `Choose a whole bar from 1 to ${this.source.bars}. The last valid section is still selected.`; return;
        }
        this.options[field] = input.type === 'checkbox' ? input.checked : input.type === 'number' || field === 'repeats' ? Number(input.value) : input.value;
        if (field === 'startBar' && this.options.endBar < this.options.startBar) this.options.endBar = this.options.startBar;
        if (field === 'endBar' && this.options.startBar > this.options.endBar) this.options.startBar = this.options.endBar;
        this.persist(); this.onChange();
      });
    }
    this.el('track-filters').innerHTML = [['0', 'All tracks'], ...LEVELS.map((name, i) => [String(i + 1), `Level ${i + 1}`])].map(([id, label]) => `<button class="button quiet" data-level="${id}" aria-pressed="${id === '0'}">${label}</button>`).join('');
    this.el('track-filters').addEventListener('click', event => { const button = event.target.closest('[data-level]'); if (button) { this.level = Number(button.dataset.level); this.renderTracks(); } });
    this.el('track-list').addEventListener('click', event => { const button = event.target.closest('[data-lesson]'); if (button) { this.el('tracks-dialog').close(); this.onChoose(button.dataset.lesson); } });
    this.renderHistory();
  }
  persist() {
    try { localStorage.setItem('groove-lab-practice-v1', JSON.stringify({ ...this.options, key: this.key })); } catch { /* Practice works without storage. */ }
  }
  setSource(source, key) {
    if (key !== this.key) {
      const keepSaved = this.key === null && key === this.storedKey;
      this.key = key;
      if (!keepSaved) Object.assign(this.options, { enabled: false, startBar: 1, endBar: Math.min(4, source.bars), focus: 'all' });
    }
    this.source = source;
    this.options.startBar = Math.max(1, Math.min(source.bars, this.options.startBar));
    this.options.endBar = Math.max(this.options.startBar, Math.min(source.bars, this.options.endBar));
    this.el('loop-enabled').checked = this.options.enabled;
    this.el('loop-from').value = this.options.startBar;
    this.el('loop-to').value = this.options.endBar;
    this.el('loop-from').max = this.el('loop-to').max = source.bars;
    this.el('loop-repeats').value = this.options.repeats;
    this.el('tempo-step').checked = source.kind === 'groove' && this.options.stepUp;
    this.el('practice-focus').value = this.options.focus;
    this.persist();
    this.lock(false);
  }
  lock(locked) {
    for (const id of ['loop-enabled', 'practice-focus']) this.el(id).disabled = locked;
    for (const id of ['loop-from', 'loop-to', 'loop-repeats']) this.el(id).disabled = locked || !this.options.enabled;
    this.el('tempo-step').disabled = locked || !this.options.enabled || this.source?.kind !== 'groove' || this.options.repeats === 1;
  }
  build(source) {
    try {
      const chart = createPracticeChart(source, this.options);
      const info = chart.practice;
      const tempos = chart.passes.map(pass => Math.round(pass.bpm));
      this.valid = true;
      this.el('practice-summary').classList.remove('error');
      this.el('practice-summary').textContent = `${this.options.enabled ? `Bars ${info.startBar}–${info.endBar} · ${info.repeats} pass${info.repeats === 1 ? '' : 'es'}` : 'Whole track'} · ${FOCUS_OPTIONS[info.focus]} · ${chart.notes.length} hits · ${formatDuration(chart.duration)}${info.increment ? ` · ${tempos[0]} → ${tempos.at(-1)} BPM` : ''}. ${info.repeats > 1 ? 'One count-in, then continuous repeats.' : 'One count-in before you start.'}${source.kind === 'midi' ? ' Uses your song sync settings.' : ''}`;
      return chart;
    } catch (error) {
      this.valid = false;
      this.el('practice-summary').classList.add('error');
      this.el('practice-summary').textContent = error.message;
      return source;
    }
  }
  openTracks() { this.renderTracks(); this.el('tracks-dialog').showModal(); }
  renderTracks() {
    for (const button of this.el('track-filters').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.level) === this.level));
    this.el('track-list').innerHTML = Object.entries(GROOVES).map(([id, track], index) => {
      if (this.level && track.level !== this.level) return '';
      const best = this.history.filter(run => run.grooveId === id && run.focus === 'all' && run.full).sort((a, b) => b.accuracy - a.accuracy)[0];
      return `<article class="lesson-tile"><div class="lesson-tile-heading"><span class="lesson-number">${String(index + 1).padStart(2, '0')}</span><span class="lesson-level">LEVEL ${track.level} · ${LEVELS[track.level - 1]}</span></div><h3>${escapeHtml(track.name)}</h3><p>${escapeHtml(track.description)}</p><div class="lesson-meta"><span>${escapeHtml(track.skill)}</span><span>${track.bpm} BPM start</span></div><div class="lesson-tile-footer"><small>${best ? `Recent best full-kit ${Math.round(best.accuracy)}% · ${best.bpm}${best.endBpm !== best.bpm ? `→${best.endBpm}` : ''} BPM · ±${best.tolerance} ms` : 'Ready to explore'}</small><button class="button secondary" data-lesson="${id}">Practice →</button></div></article>`;
    }).join('');
  }
  record(judge, settings) {
    const score = judge.summary(), chart = judge.chart;
    const record = { at: Date.now(), grooveId: chart.grooveId || null, title: chart.title, accuracy: score.accuracy, meanAbsMs: score.meanAbsMs, bpm: Math.round(chart.bpm), endBpm: Math.round(chart.passes.at(-1).bpm), tolerance: settings.tolerance, focus: chart.practice.focus, full: chart.practice.full, section: `${chart.practice.startBar}–${chart.practice.endBar}`, repeats: chart.practice.repeats, hits: score.hits, total: score.total };
    this.history = savePracticeHistory(this.history, record);
    try { localStorage.setItem('groove-lab-history-v1', JSON.stringify(this.history)); } catch { /* Keep this visit's history in memory. */ }
    this.renderHistory();
  }
  renderHistory() {
    const touched = new Set(this.history.filter(run => run.grooveId).map(run => run.grooveId)).size;
    this.el('progress-summary').textContent = `${touched} of ${Object.keys(GROOVES).length} tracks in recent runs · ${this.history.length} attempt${this.history.length === 1 ? '' : 's'}`;
    this.el('recent-practice').innerHTML = this.history.length ? this.history.slice(0, 5).map(run => `<article class="history-row"><div><strong>${escapeHtml(run.title)}</strong><span>${new Date(run.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${run.bpm}${run.endBpm !== run.bpm ? `→${run.endBpm}` : ''} BPM · Bars ${escapeHtml(run.section)} × ${run.repeats} · ${escapeHtml(FOCUS_OPTIONS[run.focus] || 'All drums')} · ±${run.tolerance} ms</span></div><div><strong>${Math.round(run.accuracy)}%</strong><span>${run.meanAbsMs === null ? 'No matched hits' : `${Math.round(run.meanAbsMs)} ms avg. error`}</span></div></article>`).join('') : '<p class="history-empty">Your completed keyboard practice runs will appear here. Start with a comfortable tempo and watch your timing improve.</p>';
  }
}
