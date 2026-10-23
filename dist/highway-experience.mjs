const highwayClamp = value => Math.max(0, Math.min(1, value));

export function highwayPerformance(judge, time, { playing = false, listen = false, teacher = false } = {}) {
  const progress = highwayClamp(time / (judge?.chart?.duration || 1));
  if (teacher || listen || judge?.followAlong) return { kind: 'progress', value: Math.round(progress * 100), label: teacher ? 'Teacher guide' : listen ? 'Listen mode' : 'Follow along', detail: 'Song progress', streak: null, tone: 'neutral' };
  if (!playing || !judge) return { kind: 'ready', value: null, label: 'Ready', detail: 'Play to begin', streak: null, tone: 'neutral' };
  if (time < 0) return { kind: 'ready', value: null, label: 'Count-in', detail: 'Find the beat', streak: null, tone: 'neutral' };
  const score = judge.summary(), judged = score.hits + score.misses + (score.wrong || 0) + score.extras;
  const value = judged ? Math.round(score.hits / judged * 100) : null;
  return { kind: 'performance', value, label: 'Performance', detail: 'Notes judged so far', streak: judge.streak || 0, tone: value === null ? 'neutral' : value >= 85 ? 'strong' : value >= 60 ? 'steady' : 'building' };
}

export function highwayMeterMarkup(id) {
  return `<aside id="${id}" class="highway-meter" aria-label="Live performance meter" hidden><span data-meter-label>Ready</span><strong data-meter-value>—</strong><div class="highway-meter-track" role="progressbar" aria-label="Live performance" aria-valuemin="0" aria-valuemax="100"><i></i></div><small data-meter-detail>Play to begin</small><b data-meter-streak></b></aside>`;
}

export function drawHighwayMeter(root, frame) {
  const key = JSON.stringify(frame); if (root.dataset.frame === key) return; root.dataset.frame = key;
  root.dataset.tone = frame.tone;
  root.querySelector('[data-meter-label]').textContent = frame.label;
  root.querySelector('[data-meter-value]').textContent = frame.value === null ? '—' : frame.value + '%';
  root.querySelector('[data-meter-detail]').textContent = frame.detail;
  root.querySelector('[data-meter-streak]').textContent = frame.kind === 'progress' ? 'Unscored' : frame.streak === null ? '' : frame.streak + ' streak';
  const track = root.querySelector('.highway-meter-track');
  track.setAttribute('aria-label', frame.kind === 'progress' ? 'Song progress' : 'Performance on notes judged so far');
  if (frame.value === null) track.removeAttribute('aria-valuenow'); else track.setAttribute('aria-valuenow', String(frame.value));
  track.firstElementChild.style.height = (frame.value || 0) + '%';
}

export class HighwayExperience {
  constructor(root, id, onChange = () => {}) {
    this.root = root; this.onChange = onChange;
    root.insertAdjacentHTML('beforeend', `<div class="highway-look" id="${id}-look"><label>Style<select aria-label="Highway style"><option value="classic">Classic</option><option value="arcade">Arcade</option></select></label><label><input type="checkbox" checked>Effects</label></div>${highwayMeterMarkup(id)}`);
    this.meter = document.getElementById(id); this.controls = document.getElementById(id + '-look');
    this.select = this.controls.querySelector('select'); this.effects = this.controls.querySelector('input');
    this.motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    let preferences = {}; try { preferences = JSON.parse(localStorage.getItem('groove-highway-look-v1') || '{}') || {}; } catch {}
    this.select.value = preferences.style === 'arcade' ? 'arcade' : 'classic'; this.effects.checked = preferences.effects !== false;
    const update = () => { try { localStorage.setItem('groove-highway-look-v1', JSON.stringify({ style: this.select.value, effects: this.effects.checked })); } catch {} this.apply(); window.dispatchEvent(new CustomEvent('highway-look-change', { detail: { style: this.select.value, effects: this.effects.checked } })); };
    this.select.onchange = this.effects.onchange = update;
    window.addEventListener('highway-look-change', event => { this.select.value = event.detail.style; this.effects.checked = event.detail.effects; this.apply(); });
    this.motion?.addEventListener?.('change', () => this.apply()); this.apply();
  }
  get options() { return { arcade: this.select.value === 'arcade', motion: this.effects.checked && !this.motion?.matches }; }
  apply() { this.root.classList.toggle('arcade-highway', this.options.arcade && this.visible !== false); this.onChange(); }
  setVisible(visible) {
    if (this.visible === visible) return;
    this.visible = visible; this.meter.hidden = this.controls.hidden = !visible; this.root.classList.toggle('has-highway-meter', visible); this.apply();
  }
  draw(judge, time, options) { const now = performance.now(); if (this.visible && (!this.lastDraw || now - this.lastDraw >= 80)) { this.lastDraw = now; drawHighwayMeter(this.meter, highwayPerformance(judge, time, options)); } }
}

// A smooth 1 Hz light swell and small note-local hit bursts; never full-screen flashes.
export function arcadePulse(time, motion = true) { return motion ? .72 + .28 * Math.sin(Math.max(0, time) * Math.PI * 2) : .85; }
export function drawArcadeBackdrop(ctx, width, height, time, { motion = true } = {}) {
  const pulse = arcadePulse(time, motion);
  ctx.fillStyle = '#071020'; ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1; ctx.strokeStyle = '#584e9e66';
  for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(width / 2, 20); ctx.lineTo(width * i / 8, height); ctx.stroke(); }
  ctx.globalAlpha = .25 + .12 * pulse; ctx.fillStyle = '#35dbf0'; ctx.fillRect(0, 0, 3, height); ctx.fillStyle = '#ed68d3'; ctx.fillRect(width - 3, 0, 3, height); ctx.globalAlpha = 1;
}
export function drawArcadeBurst(ctx, x, y, color, age, { motion = true } = {}) {
  if (!motion || age < 0 || age > .32) return;
  const progress = age / .32, radius = 8 + 25 * progress;
  ctx.globalAlpha = (1 - progress) * .8; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius); ctx.lineTo(x + Math.cos(angle) * (radius + 7), y + Math.sin(angle) * (radius + 7)); ctx.stroke(); }
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
}
