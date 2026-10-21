// Maximize only the score, keeping its transport inside the fullscreen element.
export class ScoreScreen {
  constructor({ root, opener, exit, play, listen, title, toolbar, document: doc = document, onPlay, onListen }) {
    Object.assign(this, { root, opener, exitButton: exit, playButton: play, listenButton: listen, title, toolbar, doc });
    this.active = false; this.native = false; this.revision = 0;
    opener.addEventListener('click', () => this.enter());
    exit.addEventListener('click', () => this.exit());
    play.addEventListener('click', onPlay); listen.addEventListener('click', onListen);
    doc.addEventListener('fullscreenchange', () => {
      if (doc.fullscreenElement === root) {
        this.native = true;
        if (!this.active) this.exit();
      } else if (this.native) { this.native = false; this.setActive(false); this.restoreFocus(); }
    });
    doc.addEventListener('keydown', event => this.handleKey(event), true);
    this.setPlayback({});
  }
  setActive(active) {
    this.active = active;
    this.root.classList.toggle('score-expanded', active);
    this.doc.body.classList.toggle('score-maximized', active);
    this.toolbar.hidden = !active;
    this.opener.setAttribute('aria-pressed', String(active));
  }
  async enter() {
    if (this.active) return;
    const revision = ++this.revision;
    this.setActive(true); this.playButton.focus({ preventScroll: true });
    // The viewport layout also works in embedded browsers that deny native fullscreen.
    try {
      if (this.root.requestFullscreen && this.doc.fullscreenEnabled !== false) {
        await this.root.requestFullscreen({ navigationUI: 'hide' });
        if (revision !== this.revision && this.doc.fullscreenElement === this.root) await this.exit();
      }
    } catch { /* Keep the maximized viewport layout. */ }
  }
  async exit() {
    ++this.revision; this.setActive(false);
    if (this.doc.fullscreenElement === this.root) {
      try { await this.doc.exitFullscreen(); } catch { /* Browser exit/escape may have already won the race. */ }
    }
    this.restoreFocus();
  }
  restoreFocus() { if (!this.opener.hidden && this.opener.getClientRects().length) this.opener.focus({ preventScroll: true }); }
  setTitle(title) { this.title.textContent = title; this.title.title = title; }
  setView(view) {
    const name = { highway: 'note highway', sheet: 'sheet music', full: 'full sheet' }[view] || 'note highway';
    this.opener.setAttribute('aria-label', `Full screen ${name}`);
    this.opener.title = `Full screen ${name}`;
    this.root.setAttribute('aria-label', `${name} practice`);
  }
  setPlayback({ running = false, starting = false, valid = true }) {
    const key = `${running}:${starting}:${valid}`;
    if (key === this.playbackKey) return;
    this.playbackKey = key;
    this.playButton.innerHTML = starting ? 'Starting…' : running ? '<span aria-hidden="true">■</span> Stop' : '<span aria-hidden="true">▶</span> Play';
    this.playButton.disabled = starting || !valid;
    this.listenButton.disabled = starting || running || !valid;
  }
  handleKey(event) {
    if (!this.active || this.doc.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); this.exit(); return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...this.root.querySelectorAll('button:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(item => item.getClientRects().length);
    const first = controls[0], last = controls.at(-1), current = this.doc.activeElement;
    if (!first) return;
    if (!this.root.contains(current) || (event.shiftKey && current === first) || (!event.shiftKey && current === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }
}
