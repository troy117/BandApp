import { drawSheet, scoreBeatAtTime } from './notation.mjs';

// Keep the same note objects and timeline as the other views. Only their layout changes.
export function fullScoreLayout(notation, width, { compact = false } = {}) {
  const gutter = width < 480 ? 66 : 78, right = width - 24, available = Math.max(160, right - gutter);
  const groupsByBar = new Map();
  for (const group of notation.groups) {
    if (!groupsByBar.has(group.bar)) groupsByBar.set(group.bar, []);
    groupsByBar.get(group.bar).push(group);
  }
  const rows = []; let pending = [], used = 0;
  const finish = () => {
    if (!pending.length) return;
    const occupied = pending.reduce((sum, item) => sum + item.minimum, 0);
    const scale = available / occupied;
    let left = gutter;
    const cells = pending.map(item => {
      const cell = { ...item, left, width: item.minimum * scale };
      left += cell.width; return cell;
    });
    const measures = cells.map(cell => cell.measure), groups = cells.flatMap(cell => cell.groups);
    rows.push({ index: rows.length, cells, start: measures[0].startQuarter, end: measures.at(-1).endQuarter, notation: { ...notation, measures, groups, bars: measures.length, totalBeats: measures.at(-1).endQuarter } });
    pending = []; used = 0;
  };
  for (const measure of notation.measures) {
    const groups = groupsByBar.get(measure.bar) || [];
    const smallest = groups.reduce((value, group) => Math.min(value, group.durationBeats), 1);
    const minimum = Math.max(116, (measure.endQuarter - measure.startQuarter) * Math.max(32, 17 / smallest) + 28);
    if (pending.length && used + minimum > available) finish();
    pending.push({ measure, groups, minimum }); used += minimum;
  }
  finish();
  const rowHeight = compact ? 184 : 204;
  return { rows, width, gutter, right, rowHeight, height: rows.length * rowHeight, staffTop: compact ? 80 : 82, lineGap: compact ? 10 : 11, countOffset: compact ? 32 : 48 };
}

export function fullScoreRow(layout, beat) {
  let lo = 0, hi = layout.rows.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (layout.rows[mid].end <= beat + 1e-8) lo = mid + 1; else hi = mid; }
  return layout.rows[Math.min(lo, layout.rows.length - 1)];
}

export function fullScoreX(row, beat) {
  let lo = 0, hi = row.cells.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (row.cells[mid].measure.endQuarter <= beat + 1e-8) lo = mid + 1; else hi = mid; }
  const cell = row.cells[Math.min(lo, row.cells.length - 1)];
  const fraction = Math.max(0, Math.min(1, (beat - cell.measure.startQuarter) / (cell.measure.endQuarter - cell.measure.startQuarter)));
  return cell.left + 12 + fraction * (cell.width - 24);
}

export class FullScoreView {
  constructor(container, page, canvas) {
    this.container = container; this.page = page; this.canvas = canvas; this.context = canvas.getContext('2d');
    this.followRow = -1; this.lastRunning = false;
  }
  draw(notation, chart, time, running, demo) {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height || !notation) return;
    const compact = Boolean(this.container.parentElement.classList?.contains('score-expanded'));
    if (this.notation !== notation || this.width !== width || this.compact !== compact) {
      const changed = this.notation !== notation;
      this.notation = notation; this.width = width; this.compact = compact; this.layout = fullScoreLayout(notation, width, { compact });
      this.container.parentElement.style.setProperty('--full-score-height', `${this.layout.height + 38}px`);
      this.followRow = -1;
      if (changed) this.container.scrollTop = 0;
      this.canvas.setAttribute('aria-label', `Full drum score: ${chart.bars} bars across ${this.layout.rows.length} row${this.layout.rows.length === 1 ? '' : 's'}. Follow the gold play bar. Scroll to review any row.`);
    }
    const pageHeight = `${Math.max(height, this.layout.height)}px`;
    if (this.page.style.height !== pageHeight) this.page.style.height = pageHeight;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`;
    }
    const beat = running ? scoreBeatAtTime(notation, Math.max(0, time)) : 0;
    const active = fullScoreRow(this.layout, beat);
    if (running && (!this.lastRunning || this.followRow !== active.index)) {
      const top = active.index * this.layout.rowHeight;
      if (!this.lastRunning || top < this.container.scrollTop || top + this.layout.rowHeight > this.container.scrollTop + height) this.container.scrollTop = Math.max(0, top - 24);
      this.followRow = active.index;
    }
    this.lastRunning = running;
    const ctx = this.context, scroll = this.container.scrollTop;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#18272a'; ctx.fillRect(0, 0, width, height);
    // A viewport-sized canvas draws only visible rows, even for long MIDI songs.
    const first = Math.max(0, Math.floor(scroll / this.layout.rowHeight));
    const last = Math.min(this.layout.rows.length - 1, Math.floor((scroll + height) / this.layout.rowHeight));
    for (let index = first; index <= last; index++) {
      const row = this.layout.rows[index], top = index * this.layout.rowHeight - scroll;
      ctx.save(); ctx.translate(0, top); ctx.beginPath(); ctx.rect(0, 0, width, this.layout.rowHeight); ctx.clip();
      const geometry = { gutter: this.layout.gutter, right: this.layout.right, staffTop: this.layout.staffTop, lineGap: this.layout.lineGap, playhead: fullScoreX(row, beat), x: value => fullScoreX(row, value) };
      drawSheet(ctx, { width, height: this.layout.rowHeight }, row.notation, chart, time, running, demo, { compact: true, geometry, countOffset: this.layout.countOffset, cursor: row === active, final: index === this.layout.rows.length - 1, meter: row.notation.measures[0] });
      ctx.strokeStyle = '#ffffff0d'; ctx.beginPath(); ctx.moveTo(20, this.layout.rowHeight - 1); ctx.lineTo(width - 20, this.layout.rowHeight - 1); ctx.stroke();
      ctx.restore();
    }
    this.container.dataset.activeRow = String(active.index + 1);
  }
}
