export class MobilePractice {
  constructor(practice) {
    this.practice = practice; this.q = practice.q; this.mobile = matchMedia('(max-width:800px), (orientation:landscape) and (max-height:600px)');
    this.nav = document.querySelector('.instrument-nav'); this.trigger = this.q('instrument-menu-toggle');
    this.actions = document.querySelector('.top-actions'); this.song = this.q('b-song').parentElement;
    this.song.classList.add('practice-song-picker'); this.solo = this.q('groove'); this.soloHome = this.solo.parentElement;
    this.q('b-song').setAttribute('aria-label','Practice song');
    this.soloSlot = document.createElement('label'); this.soloSlot.className = 'focus-song-picker'; this.soloSlot.setAttribute('aria-label', 'Practice song');
    this.solo.setAttribute('aria-label', 'Practice song');
    this.q('score-title').after(this.soloSlot);
    this.bandSounds = this.soundGroup(this.q('b-awake-state'));
    this.soloSounds = this.soundGroup(this.q('score-awake'));
    this.soundOptions = ['b-click', 'b-singing-click', 'b-vocal-guide-enabled', 'metronome', 'guide'].map(id => {
      const label = this.q(id).closest('label'), home = document.createComment(id + ' home');
      label.before(home); return { id, label, home };
    });
    this.joinButton = document.createElement('button'); this.joinButton.id = 'join-active-jam'; this.joinButton.className = 'button quiet'; this.joinButton.hidden = true; this.actions.append(this.joinButton);
    this.joinButton.onclick = () => practice.attempt(async () => { practice.setMode('jam'); if (practice.rooms.room) return; if (this.invitations?.length === 1) await practice.rooms.join(this.invitations[0].id); });
    this.mobile.addEventListener('change', () => this.layout()); window.addEventListener('resize', () => this.layout());
    window.addEventListener('practice-layout-change', () => this.layout());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); });
    this.pollTimer = setInterval(() => this.poll(), 10000); this.layout();
  }
  layout() {
    const mobile = this.mobile.matches, p = this.practice;
    if (mobile) { if (this.trigger.parentElement !== this.actions) this.actions.prepend(this.trigger); }
    else if (this.trigger.parentElement !== this.nav) this.nav.prepend(this.trigger);
    this.trigger.classList.toggle('mobile-instrument-trigger', mobile);
    this.trigger.querySelector('.instrument-label').textContent = mobile ? (p.mode === 'keyboard' ? 'Keyboard' : p.mode === 'jam' ? 'Instruments' : p.mode[0].toUpperCase() + p.mode.slice(1)) + ' ▾' : 'Instruments';
    const topbar = document.querySelector('.topbar');
    document.documentElement.style.setProperty('--mobile-nav-top', (topbar.getBoundingClientRect().bottom + scrollY + 4) + 'px');
    const vocal = p.part.instrument === 'vocals', destination = p.expanded ? this.q('b-full-song-slot') : mobile && vocal ? this.q('b-vocal-song-slot') : this.q('b-song-choices');
    if (this.song.parentElement !== destination) destination.prepend(this.song);
    this.q('b-lyrics-screen').classList.toggle('has-vocal-song-picker', mobile && vocal && !p.expanded);
    this.q('b-full-title').hidden = p.expanded;
    const soloFull = this.q('practice-stage').classList.contains('score-expanded');
    if (soloFull && this.solo.parentElement !== this.soloSlot) this.soloSlot.append(this.solo);
    else if (!soloFull && this.solo.parentElement !== this.soloHome) this.soloHome.append(this.solo);
    this.soloSlot.hidden = !soloFull; this.q('score-title').hidden = soloFull;
    this.layoutSounds(soloFull);
    document.body.classList.toggle('mobile-practice', mobile);
  }
  soundGroup(before) {
    const group = document.createElement('div'); group.className = 'focus-sound-options';
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Practice sound'); before.before(group); return group;
  }
  layoutSounds(soloFull) {
    const p = this.practice, vocal = p.part.instrument === 'vocals';
    for (const { id, label, home } of this.soundOptions) {
      const band = id.startsWith('b-');
      const show = band ? p.expanded && (id === 'b-click' ? !vocal : vocal) : soloFull;
      const destination = band ? this.bandSounds : this.soloSounds;
      if (show) { if (label.parentElement !== destination) destination.append(label); }
      else if (label.parentElement !== home.parentElement) home.after(label);
    }
    const guide = this.q('b-vocal-guide-enabled');
    guide.disabled = vocal && !p.part.chart.notes.length;
    guide.closest('label').title = guide.disabled ? 'This song does not have a vocal melody guide yet.' : '';
    this.bandSounds.hidden = !p.expanded; this.soloSounds.hidden = !soloFull;
  }
  async poll() {
    const school = this.practice.school;
    if (this.polling || document.hidden) return;
    if (!school.user || school.user.mustChangePassword) { this.joinButton.hidden = true; this.invitations = []; return; }
    this.polling = true; const generation = school.generation;
    try {
      const { rooms } = await school.request('/band/rooms'); if (generation !== school.generation) return;
      this.invitations = rooms.filter(room => room.state !== 'closed'); this.joinButton.hidden = !this.invitations.length;
      this.joinButton.textContent = this.practice.rooms.room ? 'Jam session' : school.staff ? 'Manage jam' : 'Join jam';
    } catch { if (generation === school.generation) this.joinButton.hidden = true; }
    finally { this.polling = false; }
  }
  reset() { this.invitations = []; this.joinButton.hidden = true; this.solo.querySelector('[data-school-songs]')?.remove(); }
  soloSongs() {
    const previous = this.solo.value; this.solo.querySelector('[data-school-songs]')?.remove();
    const songs = this.practice.catalog.filter(song => song.sourceKind === 'school' && song.parts.some(part => part.instrument === 'drums'));
    if (songs.length) { const group = document.createElement('optgroup'); group.label = 'School songs'; group.dataset.schoolSongs = 'true'; for (const song of songs) { const option = document.createElement('option'); option.value = 'school:' + song.id; option.textContent = song.title; group.append(option); } this.solo.append(group); }
    this.solo.value = previous;
  }
}
