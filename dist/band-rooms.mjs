import { BandLink } from './band-link.mjs';
import { escapeHtml } from './song-import.mjs';
import { followInstrument } from './follow-along.mjs';

export class BandRooms {
  constructor(practice) {
    this.practice = practice; this.school = practice.school; this.q = practice.q; this.room = null; this.loading = 0;
    this.link = new BandLink(this.school, { onRoom: room => this.receive(room), onState: (state, sync) => this.connectionState(state, sync), onError: (message, status) => { if ([401, 403, 404].includes(status) || message.includes('another tab')) this.leave(); practice.message(message); }, onSaved: takeId => { if (practice.lastReport?.takeId === takeId) { this.q('b-save-state').textContent = followInstrument(this.practice.lastReport?.part.instrument) ? 'Session participation saved. No performance score.' : 'Saved to your school account and this session.'; practice.school.refreshHistory().catch(() => {}); } } });
    this.q('b-refresh').onclick = () => practice.attempt(() => this.refresh());
    this.q('b-room-song').onchange = () => this.partChoices();
    this.q('b-create').onsubmit = event => { event.preventDefault(); practice.attempt(() => this.create()); };
    this.seatCount=2;this.studentOptions='<option value="">Choose a student</option>';
    this.q('b-add-seat').onclick=()=>{if(this.seatCount>=8)return;this.seatCount++;this.extraSeats();this.partChoices(true);};
    this.q('b-remove-seat').onclick=()=>{if(this.seatCount<=2)return;this.seatCount--;this.extraSeats();};
    this.q('b-ready').onclick = () => practice.attempt(() => this.ready());
    for (const action of ['start', 'stop', 'close']) this.q('b-room-' + action).onclick = () => practice.attempt(() => this.control(action));
    this.q('b-leave').onclick = () => this.leave();
    this.q('b-speaker-volume').oninput = () => {
      const volume = Number(this.q('b-speaker-volume').value) / 100;
      this.practice.audio.setBackingVolume(volume);
      if (this.practice.audio.master) this.practice.audio.master.gain.value = volume * 0.48;
    };
  }
  get teacher() { return this.room && this.room.teacherId === this.school.user?.id; }
  async refresh() {
    const q = this.q;
    q('b-create').hidden = !this.school.staff || !!this.room;
    q('b-take-history').hidden = !this.school.staff;
    if (!this.school.user || this.school.user.mustChangePassword) { q('b-room-help').textContent = 'Sign in with your school account and choose your own password to join a session.'; q('b-rooms').textContent = ''; return; }
    const generation = this.school.generation;
    const { rooms } = await this.school.request('/band/rooms'); if (generation !== this.school.generation) return;
    q('b-room-help').textContent = this.school.staff ? 'Assign up to eight students to one song. Each student joins from their own computer.' : 'Your teacher’s invitations appear here. Join, check your input, then press Ready.';
    q('b-rooms').innerHTML = rooms.length ? rooms.map(room => '<button class="button secondary" data-band-room="' + room.id + '">' + escapeHtml(room.arrangement.title) + '<small>' + escapeHtml(room.teacherName) + ' · ' + escapeHtml(room.state) + '</small></button>').join('') : '<p class="band-help">No sessions yet. Refresh after your teacher creates one.</p>';
    for (const button of q('b-rooms').querySelectorAll('[data-band-room]')) button.onclick = () => this.practice.attempt(() => this.join(button.dataset.bandRoom));
    if (this.school.staff) {
      const { users } = await this.school.request('/users'); if (generation !== this.school.generation) return;
      const students = users.filter(user => user.role === 'student' && user.active && !user.mustChangePassword);
      const options = students.map(user => '<option value="' + user.id + '">' + escapeHtml(user.name) + ' (@' + escapeHtml(user.username) + ')</option>').join('');
      q('b-student-a').innerHTML = '<option value="">Choose a student</option>' + options; q('b-student-b').innerHTML = '<option value="">Choose a student</option>' + options;
      this.studentOptions='<option value="">Choose a student</option>'+options;this.extraSeats();
      this.catalogChoices();
      const { takes } = await this.school.request('/band/takes'); if (generation !== this.school.generation) return;
      q('b-takes').innerHTML = takes.length ? takes.map(take => '<article class="band-person"><h4>' + escapeHtml(take.arrangement.title) + '</h4><p>' + new Date(take.at).toLocaleString() + ' · ' + escapeHtml(take.state) + ' · Take ' + take.id.slice(0,8) + '</p>' + take.results.map(result => { const assignment = take.arrangement.assignments.find(p => p.userId === result.userId); return '<p>' + escapeHtml(assignment?.name || 'Student') + ' · ' + escapeHtml(assignment?.instrument || '') + ' · ' + escapeHtml(result.state) + (result.state === 'completed' && result.record.mode === 'follow' ? ' · Followed song (unscored)' : result.state === 'completed' ? ' · ' + Math.round(result.record.accuracy) + '% · ' + result.record.hits + '/' + result.record.total + ' matched' : '') + '</p>'; }).join('') + '</article>').join('') : '<p class="band-help">Finished and interrupted shared takes appear here.</p>';
    }
  }
  catalogChoices() {
    const current = this.q('b-room-song').value;
    this.q('b-room-song').innerHTML = this.practice.catalog.map(song => '<option value="' + song.sourceKind + ':' + song.id + '">' + escapeHtml(song.title) + '</option>').join('');
    if (this.practice.catalog.some(song => song.sourceKind + ':' + song.id === current)) this.q('b-room-song').value = current;
    this.partChoices();
  }
  seatIds() {return Array.from({length:this.seatCount},(_,i)=>i===0?'a':i===1?'b':String(i+1));}
  resetSeats() {this.seatCount=2;this.studentOptions='<option value="">Choose a student</option>';this.q('b-extra-seats').textContent='';this.q('b-add-seat').disabled=false;this.q('b-remove-seat').hidden=true;}
  extraSeats() {
    const parts=new Map();for(const id of this.seatIds()){const field=this.q('b-part-'+id);if(field)parts.set(id,field.value);}
    const saved=new Map();for(let i=3;i<=8;i++){const select=this.q('b-student-'+i);if(select)saved.set(i,{user:select.value,part:this.q('b-part-'+i)?.value});}
    this.q('b-extra-seats').innerHTML=Array.from({length:this.seatCount-2},(_,i)=>'<label>Student '+(i+3)+'<select id="b-student-'+(i+3)+'">'+this.studentOptions+'</select></label><label>Part<select id="b-part-'+(i+3)+'"></select></label>').join('');
    this.partChoices();for(const [i,value] of saved)if(i<=this.seatCount){this.q('b-student-'+i).value=value.user;if(value.part)this.q('b-part-'+i).value=value.part;}
    for(const [id,value] of parts){const field=this.q('b-part-'+id);if([...field.options].some(option=>option.value===value))field.value=value;}
    this.q('b-add-seat').disabled=this.seatCount>=8;this.q('b-remove-seat').hidden=this.seatCount<=2;
  }
  partChoices(preserve=false) {
    const song = this.practice.catalog.find(song => song.sourceKind + ':' + song.id === this.q('b-room-song').value); if (!song) return;
    const choices = song.parts.map(part => '<option value="' + part.id + '">' + escapeHtml(part.name) + '</option>').join('');
    for(const [i,id] of this.seatIds().entries()){const select=this.q('b-part-'+id),previous=select.value;select.innerHTML=choices;select.value=preserve&&song.parts.some(part=>part.id===previous)?previous:(song.parts[i]||song.parts[0]).id;}
  }
  async create() {
    const song = this.practice.catalog.find(song => song.sourceKind + ':' + song.id === this.q('b-room-song').value); if (!song) return;
    const assignments=this.seatIds().map(id=>({userId:this.q('b-student-'+id).value,partId:this.q('b-part-'+id).value})).filter(p=>p.userId);
    const { room } = await this.school.request('/band/rooms', { method: 'POST', data: { sourceKind: song.sourceKind, sourceId: song.id, revisionId: song.revisionId, assignments } });
    await this.join(room.id);
  }
  async join(id) {
    if (this.room?.id === id && this.link.authenticated) return;
    this.leave(); const version = ++this.loading;
    const { room } = await this.school.request('/band/rooms/' + id); if (version !== this.loading) return;
    const { arrangement } = await this.school.request('/band/arrangements/' + room.arrangement.sourceKind + '/' + room.arrangement.id + '?revision=' + encodeURIComponent(room.arrangement.revisionId)); if (version !== this.loading) return;
    this.room = room; this.practice.stop(); this.practice.useArrangement(arrangement);
    const own = room.participants.find(p => p.userId === this.school.user.id);
    if (own) { this.practice.selectPart(own.partId); this.q('b-click').checked = false; }
    this.link.join(id); this.render(); this.practice.message('Session loaded. Check your sound and input, then press Ready.');
  }
  receive(room) {
    if (room.id !== this.room?.id) return;
    if (room.state === 'closed') { this.leave(); this.practice.message('The teacher closed this session.'); return; }
    this.room = room;
    const confirmed = room.participants.find(p => p.userId === this.school.user?.id)?.result;
    if (confirmed && this.practice.lastReport?.takeId === room.takeId) this.q('b-save-state').textContent = 'Saved to your school account and this session.';
    if (room.state === 'playing') {
      const own = room.participants.find(p => p.userId === this.school.user?.id);
      if (this.teacher || own?.state === 'playing') this.practice.startScheduled(room, this.link.clock, this.teacher);
      else if (this.practice.session?.takeId === room.takeId) this.practice.stop('This take was interrupted.', false);
    } else if (this.practice.session?.takeId) this.practice.stop(room.reason || 'Take ended.', false);
    this.render();
  }
  render() {
    const q = this.q, room = this.room;
    q('b-current-room').hidden = !room; q('b-create').hidden = !this.school.staff || !!room;
    q('b-rooms').hidden = !!room;
    this.practice.lockControls();
    if (!room) { q('b-practice').hidden = false; return; }
    q('b-practice').hidden = !!this.teacher;
    q('b-room-state').textContent = room.state.toUpperCase();
    q('b-room-title').textContent = room.arrangement.title + ' · ' + room.teacherName;
    q('b-performers').innerHTML = room.participants.map(p => {
      const stats = p.result || p.progress, position = p.result ? room.arrangement.duration : p.progress?.position || 0;
      const follow=followInstrument(p.instrument);
      return '<article class="band-person"><h4>' + escapeHtml(p.name) + ' · ' + escapeHtml(p.instrument) + '</h4><p>' + escapeHtml(p.state) + ' · ' + (p.connected ? 'Connected' : 'Not connected') + (p.input ? ' · ' + escapeHtml(p.input) : '') + '</p><strong class="band-person-score">' + (follow?'Follow-along':stats ? Math.round(stats.accuracy) + '%' : '—') + '</strong><progress max="' + room.arrangement.duration + '" value="' + position + '" aria-label="' + escapeHtml(p.name) + ' song progress"></progress><p>' + (follow?'Song progress only · no performance score':stats ? stats.hits + ' matched · ' + stats.misses + ' missed · ' + stats.wrong + ' wrong · ' + stats.extras + ' extra · Best streak ' + stats.bestStreak + (stats.meanMs === null ? '' : ' · ' + Math.round(Math.abs(stats.meanMs)) + ' ms ' + (stats.meanMs < 0 ? 'early' : 'late')) : 'Waiting for a take.') + '</p><p>' + escapeHtml(p.message || '') + '</p></article>';
    }).join('');
    const own = room.participants.find(p => p.userId === this.school.user?.id);
    q('b-ready').hidden = room.state !== 'preparing';
    q('b-ready').disabled = this.preparing || !this.link.clock.status.ready || !this.link.authenticated;
    q('b-ready').textContent = this.preparing ? 'Loading sound…' : (this.teacher ? room.teacherReady : own?.ready) ? 'Ready ✓' : this.teacher ? 'Enable classroom speaker & Ready' : 'Check sound & Ready';
    q('b-room-start').hidden = !this.teacher; q('b-room-start').disabled = room.state !== 'preparing' || !room.teacherReady || room.participants.some(p => !p.connected || !p.ready);
    q('b-room-stop').hidden = !this.teacher; q('b-room-stop').textContent = room.state === 'playing' ? 'Stop take' : 'Prepare next take';
    q('b-room-close').hidden = !this.teacher; q('b-teacher-volume').hidden = !this.teacher;
    q('b-room-help').textContent = room.reason || (this.teacher ? 'When everyone is Ready, start one count-in for all students.' : 'Your teacher controls the count-in and playback. Keep this tab visible.');
  }
  connectionState(state, sync) {
    this.q('b-sync').textContent = sync ? state + ' · round trip ' + Math.round(sync.rttMs) + ' ms · estimated clock uncertainty ' + Math.round(sync.uncertaintyMs) + ' ms' : state;
    if (this.practice.session?.takeId && (!sync || !sync.ready || Math.abs((sync.offset ?? 0) - this.practice.session.clockOffset) > 60)) this.practice.stop('Connection or timing changed. Wait for a fresh take.');
    if (this.prepared && (!sync || !sync.ready || Math.abs(sync.offset - this.preparedOffset) > 60)) this.unready('Connection or timing changed.');
    this.render();
  }
  async ready() {
    if (this.preparing) return;
    if (!this.room || !this.link.clock.status.ready || document.querySelector('dialog[open]')) throw new Error('Wait for synchronization, close account controls, then try Ready again.');
    const token = this.prepareToken = (this.prepareToken || 0) + 1;
    const version = this.room.version, generation = this.school.generation;
    this.preparing = true; this.render();
    try {
    await this.practice.prepareAudio();
    if (token !== this.prepareToken || !this.room || this.room.version !== version || this.school.generation !== generation || document.hidden || document.querySelector('dialog[open]')) return;
    const input = this.teacher ? 'Classroom speaker' : this.practice.inputLabel();
    if (!this.link.send({ type: 'ready', version, revisionId: this.room.arrangement.revisionId, audio: true, input, sync: this.link.clock.status })) throw new Error('Reconnect before pressing Ready.');
    this.prepared = true; this.preparedOffset = this.link.clock.status.offset;
    if (!this.teacher) { this.q('b-input-controls').open = false; this.q('b-stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (this.teacher) { this.practice.audio.master.gain.value = Number(this.q('b-speaker-volume').value) / 100 * 0.48; this.practice.audio.click(this.practice.audio.context.currentTime + 0.03, true); }
    this.practice.message('Sound enabled. Check an instrument note, then keep this tab visible for the shared count-in.');
    } finally { this.preparing = false; this.render(); }
  }
  async control(action) {
    if (!this.room) return;
    if (action === 'start' && this.practice.audio.context?.state !== 'running') throw new Error('Enable the classroom speaker first.');
    const { room } = await this.school.request('/band/rooms/' + this.room.id + '/' + action, { method: 'POST', data: { version: this.room.version } });
    this.receive(room); if (action === 'close') this.leave();
  }
  unready(reason) { this.prepareToken = (this.prepareToken || 0) + 1; this.prepared = false; if (this.room) this.link.send({ type: 'unready', version: this.room.version, reason }); }
  progress(summary, position) { if (this.room?.takeId) this.link.send({ type: 'progress', takeId: this.room.takeId, summary, position }); }
  finish(summary) {
    if (!this.room?.takeId || !this.link.send({ type: 'finish', takeId: this.room.takeId, summary })) this.q('b-save-state').textContent = 'Connection lost: this take could not be confirmed as completed. Your local CSV is available.';
  }
  leave() {
    this.loading++; this.prepareToken = (this.prepareToken || 0) + 1; this.prepared = false; this.practice.stop('Left the session.'); this.link.leave(); this.room = null; this.practice.startedTake = null; this.q('b-click').checked = true; this.render();
    if (this.practice.audio.master) this.practice.audio.master.gain.value = 0.48;
  }
}
