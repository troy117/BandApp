export const awakeLabel = state => state === 'held' ? 'Screen awake' : state === 'requesting' ? 'Keeping screen awake…' : state === 'off' ? '' : 'Screen may sleep · check phone settings';

export class ScreenAwake {
  constructor({ document: doc = globalThis.document, navigator: nav = globalThis.navigator, onState = () => {} } = {}) {
    Object.assign(this, { doc, nav, onState }); this.active = false; this.revision = 0;
    doc?.addEventListener('visibilitychange', () => { if (doc.hidden) this.revision++; this.sync(); });
    doc?.addEventListener('pointerdown', () => { if (this.active && !this.lock && !this.pending) this.sync(); });
    globalThis.addEventListener?.('pagehide', () => this.setActive(false));
  }
  setActive(active) { if (this.active !== active) this.revision++; this.active = active; return this.sync(); }
  async sync() {
    const revision = this.revision;
    if (!this.active || this.doc?.hidden) { const lock = this.lock; this.lock = null; await lock?.release().catch(() => {}); if (!this.active || this.doc?.hidden) this.onState('off'); return; }
    if (this.lock && !this.lock.released) return;
    if (!this.nav?.wakeLock?.request) { this.onState('unsupported'); return; }
    if (this.pending) return;
    this.pending = true; this.onState('requesting');
    try {
      const lock = await this.nav.wakeLock.request('screen');
      if (!this.active || this.doc?.hidden || revision !== this.revision) { await lock.release(); return; }
      this.lock = lock; lock.addEventListener('release', () => { if (this.lock === lock) { this.lock = null; this.onState(this.active ? 'released' : 'off'); } }); this.onState('held');
    } catch { if (this.active && !this.doc?.hidden) this.onState('unavailable'); }
    finally { this.pending = false; if (revision !== this.revision && this.active && !this.doc?.hidden && !this.lock) this.sync(); }
  }
}
