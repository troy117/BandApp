import { escapeHtml } from './song-import.mjs';
import { DRUMS } from './engine.mjs';
import { FOCUS_OPTIONS } from './practice.mjs';
import { passwordMinimum, PASSWORD_MAX_LENGTH } from './password-policy.mjs';
import { instrumentOptions } from './student-preferences.mjs';

export class SchoolClient {
  constructor({ onIdentity, onHistory, beforeOpen }) {
    this.onIdentity = onIdentity; this.onHistory = onHistory; this.beforeOpen = beforeOpen;
    this.user = null; this.csrf = ''; this.enabled = false; this.loaded = false; this.generation = 0; this.pending = []; this.requests = new Set(); this.roster = [];
    this.el = id => document.getElementById(id);
    document.body.insertAdjacentHTML('beforeend', schoolMarkup());
    this.el('school-account-status').insertAdjacentHTML('beforebegin', '<details id="school-storage-details" class="school-storage" hidden><summary>School storage & recovery</summary><p id="school-storage-summary"></p><dl><dt>Data folder</dt><dd id="school-storage-folder"></dd><dt>School identity</dt><dd><code id="school-storage-id"></code></dd><dt>Database recovery copy</dt><dd id="school-storage-copy"></dd></dl><p class="school-help">Keep the same Railway volume attached across updates. Enable daily volume backups in Railway, and keep a complete private backup outside the running service.</p><p class="school-help">For protection against switching schools, set GROOVE_EXPECTED_SCHOOL_ID in Railway to the school identity above. Remove GROOVE_ALLOW_NEW_SCHOOL after first setup.</p><button id="school-storage-refresh" class="text-button">Refresh storage check</button><p id="school-storage-status" role="status"></p></details>');
    this.el('school-storage-refresh').addEventListener('click', () => this.loadStorage());
    this.el('open-school').addEventListener('click', () => this.openAccount());
    this.el('school-manage-audio').addEventListener('click', () => { if (!this.staff || this.user?.mustChangePassword) return; this.beforeOpen(); this.el('school-account-dialog').close(); window.dispatchEvent(new CustomEvent('school-audio-library')); });
    this.el('school-login-form').addEventListener('submit', event => { event.preventDefault(); this.authenticate(false); });
    this.el('school-setup-form').addEventListener('submit', event => { event.preventDefault(); this.authenticate(true); });
    this.el('school-password-form').addEventListener('submit', event => { event.preventDefault(); this.changePassword(); });
    this.el('school-user-form').addEventListener('submit', event => { event.preventDefault(); this.createUser(); });
    this.el('school-student-password-form').addEventListener('submit', event => { event.preventDefault(); this.setStudentPassword(); });
    this.el('school-student-password-dialog').addEventListener('close', () => { this.passwordStudent = null; this.el('school-set-password').value = ''; this.el('school-student-password-status').textContent = ''; });
    this.el('school-role').addEventListener('change', () => this.renderTeacherChoice());
    this.el('school-open-dashboard').addEventListener('click', () => this.openDashboard());
    this.el('school-change-password').addEventListener('click', () => this.openPassword());
    this.el('school-signout').addEventListener('click', () => this.signout());
    this.el('school-back-roster').addEventListener('click', () => this.loadRoster());
    this.el('school-own-progress').addEventListener('click', () => this.showProgress(this.user.id));
    this.el('school-more-results').addEventListener('click', () => this.showProgress(this.progressUser, true));
    this.el('school-refresh-roster').addEventListener('click', () => this.loadRoster());
    this.el('school-copy-login').addEventListener('click', () => this.copyCredentials());
    this.el('school-roster').addEventListener('click', event => this.rosterAction(event));
    this.el('school-roster').addEventListener('change', event => { if(event.target.dataset.instrumentUser) this.setInstrument(event.target.dataset.instrumentUser, event.target.value); });
    this.el('school-account-status').insertAdjacentHTML('beforebegin', '<label id="school-default-field" class="school-default-field" hidden>Default instrument<select id="school-default-instrument">' + instrumentOptions() + '</select></label>');
    this.el('school-default-instrument').onchange = () => this.setInstrument(this.user.id, this.el('school-default-instrument').value);
    this.el('school-results').addEventListener('click', event => { const button=event.target.closest('[data-open-run]');if(button){this.el('school-dashboard-dialog').close();window.dispatchEvent(new CustomEvent('practice-open-report',{detail:{record:this.progressRecords.find(run=>run.id===button.dataset.openRun),userId:this.progressUser}}));} });
    for (const button of document.querySelectorAll('[data-school-close]')) button.addEventListener('click', () => this.el(button.dataset.schoolClose).close());
    for (const id of ['school-account-dialog', 'school-dashboard-dialog', 'school-password-dialog']) this.el(id).addEventListener('close', () => { this.el('school-login-password').value = ''; this.el('school-setup-password').value = ''; this.el('school-current-password').value = ''; this.el('school-new-password').value = ''; if (id === 'school-dashboard-dialog') { this.el('school-student-password').value = ''; this.el('school-credentials').hidden = true; this.el('school-credential-password').textContent = ''; } });
    this.el('recent-practice').insertAdjacentHTML('beforebegin', '<div id="school-result-state" class="school-result-state" hidden><span id="school-result-message" role="status"></span><button id="school-retry-results" class="text-button" hidden>Retry saving</button></div>');
    this.el('school-retry-results').addEventListener('click', () => this.flushRuns());
    window.addEventListener('online', () => this.flushRuns());
    window.addEventListener('focus', () => { if (this.user) this.refreshSession().catch(() => {}); });
  }
  get staff() { return this.user?.role === 'teacher' || this.user?.role === 'owner'; }
  async request(route, { method = 'GET', data, signal } = {}) {
    const version = this.generation, controller = new AbortController(); this.requests.add(controller);
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
    const binary = data instanceof ArrayBuffer || ArrayBuffer.isView(data);
    try {
      const response = await fetch(`/api${route}`, { method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { ...(method !== 'GET' && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}), ...(data !== undefined ? { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' } : {}) }, ...(data !== undefined ? { body: binary ? data : JSON.stringify(data) } : {}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { if (response.status === 401 && this.user && version === this.generation) this.identity(null, ''); const error = new Error(payload.error || 'The school service is unavailable. Try again.'); error.status = response.status; throw error; }
      if (version !== this.generation) throw new Error('The signed-in account changed. Try again.');
      return payload;
    } finally { signal?.removeEventListener('abort', abort); this.requests.delete(controller); }
  }
  async download(route) {
    const version = this.generation, response = await fetch(`/api${route}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) { const error = await response.json().catch(() => ({})); if (response.status === 401 && this.user && version === this.generation) this.identity(null, ''); throw new Error(error.error || 'Could not download this song.'); }
    const bytes = await response.arrayBuffer(); if (version !== this.generation) throw new Error('The signed-in account changed.'); return bytes;
  }
  identity(user, csrf) {
    const changed = (this.user?.id ?? null) !== (user?.id ?? null);
    if (changed) {
      this.generation++; for (const controller of this.requests) controller.abort();
      this.pending = []; this.roster = []; this.progressRecords = []; this.progressUser = null; this.nextCursor = null;
      for (const id of ['school-account-dialog', 'school-dashboard-dialog', 'school-password-dialog', 'school-student-password-dialog']) this.el(id).close();
      this.passwordStudent = null; this.el('school-set-password').value = '';
      this.el('school-user-form').reset();
      for (const id of ['school-roster', 'school-results', 'school-progress-name', 'school-progress-summary', 'school-credential-username', 'school-credential-password']) this.el(id).textContent = '';
      this.el('school-credentials').hidden = true; this.el('school-roster-section').hidden = true; this.el('school-progress-section').hidden = true;
    }
    this.user = user; this.csrf = csrf || ''; this.renderAccount();
    this.el('school-default-field').hidden = !user;this.el('school-default-instrument').value = user?.defaultInstrument || 'drums';
    if (changed) this.onIdentity(user);
    if (changed || !this.pending.length) this.resultState('');
  }
  async init() {
    if (!['http:', 'https:'].includes(location.protocol)) { this.loaded = true; this.renderAccount(); return; }
    try { await this.refreshSession(); } catch { this.loaded = true; this.renderAccount(); }
  }
  async refreshSession() {
    const session = await this.request('/session');
    this.enabled = session.enabled; this.storageMessage = session.storageMessage || ''; this.loaded = true; this.setupNeeded = session.setupNeeded; this.setupTokenRequired = session.setupTokenRequired; this.schoolId = session.schoolId; this.schoolName = session.schoolName || 'School library';
    this.identity(session.user, session.csrf);
    if (this.user && !this.user.mustChangePassword) await this.refreshHistory();
  }
  renderAccount() {
    this.el('open-school').textContent = this.user ? `${this.user.name} · ${this.staff ? 'Teacher' : 'Student'}` : this.storageMessage ? 'School storage needs attention' : 'School sign in';
    this.el('school-account-title').textContent = this.user ? 'Your school account.' : this.setupNeeded ? 'Set up your school.' : 'Welcome back.';
    this.el('school-account-unavailable').hidden = !this.loaded || this.enabled;
    this.el('school-account-unavailable').textContent = this.storageMessage || (location.protocol === 'file:' ? 'School accounts need the hosted web app. Open your school’s website to sign in; this offline copy still supports local practice.' : 'School accounts are not enabled on this server yet. The school owner needs to connect persistent storage. Local practice and device songs still work.');
    this.el('school-storage-details').hidden = this.user?.role !== 'owner';
    if (this.user?.role !== 'owner') { this.el('school-storage-details').open = false; for (const id of ['school-storage-summary', 'school-storage-folder', 'school-storage-id', 'school-storage-copy', 'school-storage-status']) this.el(id).textContent = ''; }
    this.el('school-login-form').hidden = !this.enabled || Boolean(this.user) || this.setupNeeded;
    this.el('school-setup-form').hidden = !this.enabled || Boolean(this.user) || !this.setupNeeded;
    this.el('school-setup-key-field').hidden = !this.setupTokenRequired;
    this.el('school-setup-key').required = Boolean(this.setupTokenRequired);
    this.el('school-signed-in').hidden = !this.user;
    this.el('school-signed-in-name').textContent = this.user ? `${this.user.name} · @${this.user.username}${this.user.role === 'owner' ? ' · School owner' : ''}` : '';
    this.el('school-open-dashboard').textContent = this.staff ? 'Open classroom' : 'My practice results';
    this.el('school-open-dashboard').disabled = Boolean(this.user?.mustChangePassword);
    this.el('school-manage-audio').hidden = !this.staff; this.el('school-manage-audio').disabled = Boolean(this.user?.mustChangePassword);
    this.el('school-account-description').textContent = this.user?.mustChangePassword ? 'Choose your own password to start using the school library and save results.' : 'Use the same account at school and home. Students use a teacher-created username; no student email is needed.';
  }
  openAccount() { this.beforeOpen(); this.renderAccount(); this.el('school-account-status').textContent = ''; this.el('school-account-dialog').showModal(); if (this.user?.role === 'owner') this.loadStorage(); }
  async loadStorage() {
    if (this.user?.role !== 'owner') return;
    const generation = this.generation;
    this.el('school-storage-status').textContent = 'Checking school storage…';
    try {
      const storage = await this.request('/storage');
      if (generation !== this.generation || this.user?.role !== 'owner') return;
      this.el('school-storage-summary').textContent = `${storage.volumeVerified ? 'Railway volume checked' : storage.local ? 'Local development storage' : 'Server folder — confirm persistence with your host'} · ${storage.accounts} accounts · ${storage.songs} published songs · ${storage.attempts} practice results`;
      this.el('school-storage-folder').textContent = storage.directory; this.el('school-storage-id').textContent = storage.schoolId;
      this.el('school-storage-copy').textContent = storage.snapshot ? `${storage.snapshot.file} · ${schoolDate(storage.snapshot.createdAt)}` : 'A database recovery copy is created on the next app start after an owner exists.';
      this.el('school-storage-status').textContent = storage.local ? 'Local test storage. Production protections apply to the hosted school.' : storage.newSchoolAllowed ? 'Remove GROOVE_ALLOW_NEW_SCHOOL from Railway now that setup is complete.' : 'Automatic creation of a replacement school is disabled.';
    } catch (error) { if (generation === this.generation && this.user?.role === 'owner') this.el('school-storage-status').textContent = error.message; }
  }
  async authenticate(setup) {
    const form = this.el(setup ? 'school-setup-form' : 'school-login-form'), submit = form.querySelector('button[type=submit]'); submit.disabled = true;
    this.el('school-account-status').textContent = setup ? 'Creating the school owner account…' : 'Signing in…';
    try {
      const data = setup ? { username: this.el('school-setup-username').value, name: this.el('school-setup-name').value, schoolName: this.el('school-setup-name-school').value, password: this.el('school-setup-password').value, setupToken: this.el('school-setup-key').value } : { username: this.el('school-login-username').value, password: this.el('school-login-password').value };
      const response = await this.request(setup ? '/setup' : '/login', { method: 'POST', data });
      this.setupNeeded = false; this.identity(response.user, response.csrf); this.el('school-account-dialog').close();
      if (this.user.mustChangePassword) this.openPassword(); else { if (setup) await this.refreshSession(); else await this.refreshHistory(); if(this.staff)await this.openDashboard(); }
    } catch (error) { this.el('school-account-status').textContent = error.message; }
    finally { submit.disabled = false; this.el('school-login-password').value = ''; this.el('school-setup-password').value = ''; this.el('school-setup-key').value = ''; }
  }
  openPassword() {
    this.beforeOpen(); this.el('school-account-dialog').close(); const minimum = passwordMinimum(this.user?.role);
    this.el('school-new-password').minLength = minimum;
    this.el('school-password-help').textContent = `Use ${minimum}–${PASSWORD_MAX_LENGTH} characters. No special characters required.`;
    this.el('school-password-status').textContent = this.user?.mustChangePassword ? 'Choose a password to replace your temporary one.' : '';
    this.el('school-password-dialog').showModal();
  }
  async changePassword() {
    const button = this.el('school-password-submit'); button.disabled = true; this.el('school-password-status').textContent = 'Updating your password…';
    try { const result = await this.request('/password', { method: 'POST', data: { currentPassword: this.el('school-current-password').value, password: this.el('school-new-password').value } }); this.identity(result.user, result.csrf); this.el('school-password-dialog').close(); await this.refreshHistory(); if(this.staff)await this.openDashboard(); }
    catch (error) { this.el('school-password-status').textContent = error.message; }
    finally { button.disabled = false; }
  }
  async signout() {
    if (this.pending.length) { await this.flushRuns(); if (this.pending.length && !confirm('Some practice results have not saved. Sign out and discard those unsaved results?')) return; }
    try { await this.request('/logout', { method: 'POST', data: {} }); this.identity(null, ''); for (const id of ['school-account-dialog', 'school-dashboard-dialog', 'school-password-dialog', 'school-student-password-dialog']) this.el(id).close(); }
    catch (error) { this.el('school-account-status').textContent = error.message; }
  }
  async openDashboard() {
    if (!this.user || this.user.mustChangePassword) { this.openAccount(); return; }
    this.beforeOpen(); this.el('school-account-dialog').close(); this.el('school-dashboard-title').textContent = this.staff ? 'Your classroom.' : 'Your practice progress.';
    this.el('school-dashboard-school').textContent = this.schoolName; this.el('school-dashboard-dialog').showModal();
    this.el('school-own-progress').hidden = !this.staff;
    if (this.staff) await this.loadRoster(); else await this.showProgress(this.user.id);
  }
  async loadRoster() {
    const version = this.generation; this.el('school-dashboard-status').textContent = 'Opening your roster…';
    this.el('school-roster-section').hidden = false; this.el('school-progress-section').hidden = true;
    this.el('school-role-field').hidden = this.user?.role !== 'owner';
    try {
      const response = await this.request('/users'); if (version !== this.generation) return;
      this.roster = response.users;
      this.el('school-roster').innerHTML = this.roster.length ? this.roster.map(user => `<article class="school-student"><div><strong>${escapeHtml(user.name)}</strong><small>@${escapeHtml(user.username)} · ${user.role === 'teacher' ? 'Teacher' : 'Student'}${!user.active ? ' · Inactive' : ''}${user.teacherName ? ` · ${escapeHtml(user.teacherName)}` : ''}</small></div><div class="school-student-metrics"><span><b>${user.attempts}</b> attempts</span><span>${user.recentAccuracy === null ? 'No results yet' : `${Math.round(user.recentAccuracy)}% recent match rate`}</span><span>${user.lastPractice ? `Last practice ${schoolDate(user.lastPractice)}` : 'Ready for a first practice'}</span></div><div class="school-row-actions">${user.role==='student'?'<label>Default instrument<select data-instrument-user="'+user.id+'" aria-label="Default instrument for '+escapeHtml(user.name)+'">'+instrumentOptions(user.defaultInstrument)+'</select></label>':''}<button class="button secondary" data-student="${user.id}" data-action="progress">Results</button><button class="text-button" data-student="${user.id}" data-action="${user.role === 'student' ? 'set-password' : 'reset'}">${user.role === 'student' ? 'Set password' : 'Reset password'}</button><button class="text-button" data-student="${user.id}" data-action="active">${user.active ? 'Disable' : 'Enable'}</button></div></article>`).join('') : '<p class="school-empty">Add your first student below. Their completed practice runs will appear here.</p>';
      this.renderTeacherChoice(); this.el('school-dashboard-status').textContent = 'Recent match rates average the last 30 scored attempts, including stopped practice. Open Results to compare tempo, focus and timing.';
    } catch (error) { this.el('school-dashboard-status').textContent = error.message; }
  }
  renderTeacherChoice() {
    const owner = this.user?.role === 'owner', student = this.el('school-role').value === 'student';
    this.el('school-teacher-field').hidden = !owner || !student;
    this.el('school-student-password-field').hidden = !student;
    if (!student) this.el('school-student-password').value = '';
    this.el('school-teacher').innerHTML = this.user ? [{ id: this.user.id, name: `${this.user.name} (you)` }, ...this.roster.filter(user => user.role === 'teacher' && user.active)].map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('') : '';
  }
  async createUser() {
    const button = this.el('school-create-user'); button.disabled = true; this.el('school-dashboard-status').textContent = 'Creating the account…';
    try {
      const password = this.el('school-student-password').value;
      const response = await this.request('/users', { method: 'POST', data: { name: this.el('school-student-name').value, username: this.el('school-student-username').value, role: this.user.role === 'owner' ? this.el('school-role').value : 'student', teacherId: this.user.role === 'owner' ? this.el('school-teacher').value : undefined, defaultInstrument: this.el('school-student-instrument').value || 'drums', ...(password ? { password } : {}) } });
      this.showCredentials(response, password); this.el('school-student-name').value = ''; this.el('school-student-username').value = ''; await this.loadRoster();
    } catch (error) { this.el('school-dashboard-status').textContent = error.message; }
    finally { button.disabled = false; this.el('school-student-password').value = ''; }
  }
  showCredentials(response, password = '') {
    this.credentialTemporary = Boolean(response.user.mustChangePassword);
    this.el('school-credentials').hidden = false; this.el('school-credential-username').textContent = response.user.username;
    this.el('school-credential-label').textContent = this.credentialTemporary ? 'Temporary password' : 'Password';
    this.el('school-credential-password').textContent = response.temporaryPassword ?? password;
    this.el('school-credential-help').textContent = this.credentialTemporary ? 'Choose a new password at first sign-in. These details are shown only for this visit.' : 'Ready to sign in. No password change required. This password is shown only for this visit.';
  }
  async copyCredentials() { try { await navigator.clipboard.writeText(`Groove Lab\n${location.origin}\nUsername: ${this.el('school-credential-username').textContent}\n${this.credentialTemporary ? 'Temporary password' : 'Password'}: ${this.el('school-credential-password').textContent}\n${this.credentialTemporary ? 'Choose your own password the first time you sign in.' : 'Ready to sign in. No password change required.'}`); this.el('school-dashboard-status').textContent = 'Login details copied. Share them directly with this student.'; } catch { this.el('school-dashboard-status').textContent = 'Select and copy the displayed login details.'; } }
  openStudentPassword(user) {
    if (!this.staff || user.role !== 'student') return;
    this.passwordStudent = user; this.el('school-set-password').value = '';
    this.el('school-student-password-name').textContent = `${user.name} · @${user.username}`;
    this.el('school-student-password-status').textContent = ''; this.el('school-student-password-dialog').showModal();
  }
  async setStudentPassword() {
    const student = this.passwordStudent; if (!student || !this.staff) return;
    const password = this.el('school-set-password').value, button = this.el('school-set-password-submit'); button.disabled = true;
    this.el('school-student-password-status').textContent = 'Setting the password…';
    try {
      const response = await this.request(`/users/${student.id}/reset-password`, { method: 'POST', data: { password } });
      this.el('school-student-password-dialog').close(); this.showCredentials(response, password); await this.loadRoster();
      this.el('school-dashboard-status').textContent = `Password set for ${student.name}. They can sign in now; their practice results are retained.`;
    } catch (error) { this.el('school-student-password-status').textContent = error.message; }
    finally { button.disabled = false; this.el('school-set-password').value = ''; }
  }
  async rosterAction(event) {
    const button = event.target.closest('[data-student]'); if (!button) return;
    const user = this.roster.find(item => item.id === button.dataset.student); if (!user) return;
    if (button.dataset.action === 'progress') { await this.showProgress(user.id); return; }
    if (button.dataset.action === 'set-password') { this.openStudentPassword(user); return; }
    button.disabled = true;
    try {
      if (button.dataset.action === 'reset') this.showCredentials(await this.request(`/users/${user.id}/reset-password`, { method: 'POST', data: {} }));
      else await this.request(`/users/${user.id}/active`, { method: 'POST', data: { active: !user.active } });
      await this.loadRoster();
    } catch (error) { this.el('school-dashboard-status').textContent = error.message; }
    finally { button.disabled = false; }
  }
  async showProgress(userId, append = false) {
    const version = this.generation; this.el('school-dashboard-status').textContent = 'Opening practice results…';
    try {
      const result = await this.request(`/users/${userId}/progress${append && this.nextCursor ? `?cursor=${encodeURIComponent(this.nextCursor)}` : ''}`);
      if (version !== this.generation) return;
      this.progressUser = userId; this.nextCursor = result.nextCursor; this.progressRecords = append ? [...this.progressRecords, ...result.records] : result.records;
      this.el('school-roster-section').hidden = true; this.el('school-progress-section').hidden = false; this.el('school-back-roster').hidden = !this.staff;
      this.el('school-progress-name').textContent = `${result.user.name}’s practice`;
      const summary = result.summary;
      this.el('school-progress-summary').textContent = `${summary.attempts} practice attempt${summary.attempts === 1 ? '' : 's'} · ${summary.recentAccuracy === null ? 'Ready to begin' : `${Math.round(summary.recentAccuracy)}% recent match rate`}${summary.recentTimingMs === null ? '' : ` · ${Math.round(summary.recentTimingMs)} ms recent average error`}`;
      this.el('school-results').innerHTML = this.progressRecords.length ? this.progressRecords.map(schoolRunMarkup).join('') : '<p class="school-empty">Your reports will appear here after a scored practice attempt.</p>';
      this.el('school-more-results').hidden = !this.nextCursor; this.el('school-dashboard-status').textContent = 'Scored attempts save note reports. Stopped attempts include only the notes reached; listen mode does not add results.';
    } catch (error) { this.el('school-dashboard-status').textContent = error.message; }
  }
  async setInstrument(userId, defaultInstrument) {
    try { const result=await this.request('/users/'+userId+'/instrument',{method:'POST',data:{defaultInstrument}});
      if(userId===this.user?.id){this.user=result.user;this.el('school-default-instrument').value=result.user.defaultInstrument;}
      else { const old=this.roster.find(user=>user.id===userId);if(old)old.defaultInstrument=result.user.defaultInstrument; }
      this.el('school-dashboard-status').textContent='Default instrument saved.';this.el('school-account-status').textContent='Default instrument saved for your next sign-in.';
    } catch(error) {this.el('school-dashboard-status').textContent=error.message;this.el('school-account-status').textContent=error.message;}
  }
  async refreshHistory() { const id = this.user?.id, version = this.generation; if (!id || this.user.mustChangePassword) return; const response = await this.request(`/users/${id}/progress`); if (version === this.generation && id === this.user?.id) this.onHistory(response.records, response.summary); }
  resultState(message, retry = false) { this.el('school-result-state').hidden = !message; this.el('school-result-message').textContent = message; this.el('school-retry-results').hidden = !retry; }
  record(record, accountId) { if (!accountId || this.user?.id !== accountId) return; this.pending.push({ userId: accountId, record }); this.flushRuns(); }
  async recordBand(record, accountId) {
    if (!accountId || this.user?.id !== accountId) return;
    if (!this.pending.some(item => item.record.id === record.id)) this.pending.push({ userId: accountId, record, route: '/band/runs' });
    await this.flushRuns();
  }
  async flushRuns() {
    if (this.flushing || !this.pending.length || !this.user) return;
    this.flushing = true; const version = this.generation;
    try {
      this.resultState('Saving practice results to your school account…');
      while (this.pending.length && version === this.generation) { const item = this.pending[0]; if (item.userId !== this.user?.id) break; await this.request(item.route || '/runs', { method: 'POST', data: item.record }); this.pending = this.pending.filter(entry => entry !== item); }
      if (version === this.generation) { this.resultState('Results saved to your school account.'); await this.refreshHistory(); }
    } catch (error) { if (version === this.generation) this.resultState(this.pending.length ? `Result not saved yet: ${error.message} Keep this page open and retry.` : 'Your result saved. Open My practice results to refresh the history when the connection is available.', this.pending.length > 0); }
    finally { this.flushing = false; }
  }
  async saveSong(draft, progress = () => {}, { signal } = {}) {
    if (!this.staff) throw new Error('A teacher account is required to publish songs.');
    if (!(draft.midiBytes instanceof ArrayBuffer) || !draft.midiBytes.byteLength) throw new Error('Reimport the MIDI before publishing this song.');
    const version = this.generation, source = draft.schoolSource?.schoolId === this.schoolId && draft.schoolSource.canManage ? draft.schoolSource : null;
    let upload;
    try {
      progress('Preparing the school song…');
      if(draft.multiBacking)throw new Error('Open MIDI & audio sync to edit this song and retain all backing versions.');
      upload = await this.request('/library/uploads', { method: 'POST', signal, data: { title: (draft.schoolTitle || draft.song.title).slice(0, 120), fileName: draft.song.fileName, audioName: draft.audioName, selected: draft.selected, mapping: draft.mapping, offset: draft.offset, timeScale: draft.timeScale ?? 1, volume: draft.volume, audioStart:draft.audioStart, audioEnd:draft.audioEnd, timingMap:draft.timingMap,vocalNotes:draft.vocalNotes,lyricsAlignment:draft.lyricsAlignment, midiBytes: draft.midiBytes.byteLength, audioBytes: draft.audioBytes?.byteLength || 0, ...draft.lyricSettings, ...(draft.arrangementParts ? { parts: draft.arrangementParts.map(part => part.instrument === 'drums' ? { ...part, selected: draft.selected } : part) } : {}), ...(source ? { songId: source.songId, revisionId: source.revisionId } : {}) } });
      progress('Uploading the MIDI drum part…'); await this.request(`/library/uploads/${upload.uploadId}/midi`, { method: 'PUT', data: draft.midiBytes, signal });
      if (draft.audioBytes) { progress('Uploading the backing recording…'); await this.request(`/library/uploads/${upload.uploadId}/audio`, { method: 'PUT', data: draft.audioBytes, signal }); }
      if (signal?.aborted || version !== this.generation) throw new Error('Publishing cancelled.');
      progress('Checking the song and publishing it to the school…');
      const response = await this.request(`/library/uploads/${upload.uploadId}/publish`, { method: 'POST', data: {}, signal });
      return { ...response.song, schoolId: this.schoolId };
    } catch (error) {
      if (upload && version === this.generation) for (let attempt = 0; attempt < 3; attempt++) {
        try { await this.request(`/library/uploads/${upload.uploadId}`, { method: 'DELETE' }); break; }
        catch (cleanupError) { if (cleanupError.status !== 409 || attempt === 2) break; await new Promise(resolve => setTimeout(resolve, 250)); }
      }
      throw error;
    }
  }
}

function schoolDate(time) { return new Date(time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function schoolTiming(value) { return Math.abs(value) < 1 ? 'On time on average' : `${Math.round(Math.abs(value))} ms ${value < 0 ? 'early' : 'late'} on average`; }
function schoolMarkup() {
  return `<dialog id="school-account-dialog" class="school-account-dialog" aria-labelledby="school-account-title"><div class="dialog-header"><div><p class="eyebrow">YOUR SCHOOL. YOUR RHYTHM.</p><h2 id="school-account-title">Welcome back.</h2></div><button class="close-button" data-school-close="school-account-dialog" aria-label="Close school sign in">×</button></div><p id="school-account-description" class="dialog-description"></p><p id="school-account-unavailable" class="school-message" hidden></p>
  <form id="school-login-form" class="school-form" hidden><label>Username<input id="school-login-username" autocomplete="username" maxlength="40" required></label><label>Password<input id="school-login-password" type="password" autocomplete="current-password" maxlength="128" required></label><button class="button primary" type="submit">Sign in</button></form>
  <form id="school-setup-form" class="school-form" hidden><p class="school-message">Create the first teacher account. This account is the school owner and can add other teachers.</p><label>School name<input id="school-setup-name-school" value="Sierra Charter School" maxlength="100" required></label><label>Your display name<input id="school-setup-name" autocomplete="name" maxlength="60" required></label><label>Your username<input id="school-setup-username" autocomplete="username" pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}" maxlength="40" required></label><label>Your password or passphrase<input id="school-setup-password" type="password" autocomplete="new-password" minlength="${passwordMinimum('owner')}" maxlength="128" required><small>8 characters or longer. No special characters required.</small></label><label id="school-setup-key-field">School setup key<input id="school-setup-key" type="password" autocomplete="off"><small>The private key configured by the school owner on the hosting service.</small></label><button class="button primary" type="submit">Create school owner account</button></form>
  <div id="school-signed-in" hidden><p id="school-signed-in-name" class="school-message"></p><div class="school-actions"><button id="school-open-dashboard" class="button primary">Open classroom</button><button id="school-manage-audio" class="button secondary" hidden>MIDI &amp; audio sync</button><button id="school-change-password" class="button secondary">Change password</button><button id="school-signout" class="text-button">Sign out</button></div></div><p id="school-account-status" class="school-status" role="status"></p></dialog>
  <dialog id="school-password-dialog" class="school-account-dialog" aria-labelledby="school-password-title"><div class="dialog-header"><div><p class="eyebrow">MAKE IT YOURS</p><h2 id="school-password-title">Choose your password.</h2></div><button class="close-button" data-school-close="school-password-dialog" aria-label="Close password change">×</button></div><form id="school-password-form" class="school-form"><label>Current or temporary password<input id="school-current-password" type="password" autocomplete="current-password" maxlength="128" required></label><label>New password or passphrase<input id="school-new-password" type="password" autocomplete="new-password" minlength="${passwordMinimum('owner')}" maxlength="128" required><small id="school-password-help">Use 8–128 characters.</small></label><button id="school-password-submit" type="submit" class="button primary">Save new password</button></form><p id="school-password-status" class="school-status" role="status"></p></dialog>
  <dialog id="school-dashboard-dialog" class="school-dashboard-dialog" aria-labelledby="school-dashboard-title"><div class="dialog-header"><div><p id="school-dashboard-school" class="eyebrow">SCHOOL PRACTICE</p><h2 id="school-dashboard-title">Your classroom.</h2></div><button class="close-button" data-school-close="school-dashboard-dialog" aria-label="Close classroom">×</button></div><div class="school-actions"><button id="school-own-progress" class="text-button">My practice results</button></div>
  <section id="school-roster-section"><div class="school-section-heading"><h3>Students &amp; teachers</h3><button id="school-refresh-roster" class="text-button">Refresh roster</button></div><div id="school-roster" class="school-roster"></div><h3>Add an account</h3><form id="school-user-form" class="school-form school-create-form"><label>Display name<input id="school-student-name" maxlength="60" required autocomplete="off"><small>A first name or nickname is enough.</small></label><label>Username<input id="school-student-username" maxlength="40" pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}" required autocomplete="off"><small>At least 3 letters, numbers, dots, dashes or underscores.</small></label><label id="school-role-field" hidden>Account type<select id="school-role"><option value="student">Student</option><option value="teacher">Teacher</option></select></label><label id="school-teacher-field" hidden>Student’s teacher<select id="school-teacher"></select></label><label>Default instrument<select id="school-student-instrument">${instrumentOptions()}</select></label><label id="school-student-password-field">Student password (optional)<input id="school-student-password" type="password" autocomplete="new-password" minlength="${passwordMinimum('student')}" maxlength="128"><small>4 characters or longer. Leave blank to generate a temporary password.</small></label><button id="school-create-user" class="button primary" type="submit">Create account</button></form><p class="school-help">Students do not need email. Set a student password to let them sign in immediately, or leave it blank for a temporary password they change at first sign-in. Use Set password to choose a new student password later. Disabling an account keeps its results.</p><div id="school-credentials" class="school-credentials" hidden><h4>Share these login details directly.</h4><p>Username <code id="school-credential-username"></code></p><p><span id="school-credential-label">Password</span> <code id="school-credential-password"></code></p><button id="school-copy-login" class="button secondary">Copy login details</button><p id="school-credential-help" class="school-help">These details are shown only for this visit.</p></div></section>
  <section id="school-progress-section" hidden><button id="school-back-roster" class="text-button">← Back to roster</button><h3 id="school-progress-name"></h3><p id="school-progress-summary" class="school-message"></p><div id="school-results"></div><button id="school-more-results" class="button secondary" hidden>Load earlier results</button></section><p id="school-dashboard-status" class="school-status" role="status"></p></dialog>
  <dialog id="school-student-password-dialog" class="school-account-dialog" aria-labelledby="school-student-password-title"><div class="dialog-header"><div><p class="eyebrow">STUDENT ACCOUNT</p><h2 id="school-student-password-title">Set student password</h2></div><button class="close-button" data-school-close="school-student-password-dialog" aria-label="Cancel student password change">×</button></div><p id="school-student-password-name" class="school-message"></p><form id="school-student-password-form" class="school-form"><label>New student password<input id="school-set-password" type="password" autocomplete="new-password" minlength="${passwordMinimum('student')}" maxlength="128" required><small>4 characters or longer. No special characters required.</small></label><p class="school-help">The student can use this password immediately. Any open sign-in for this student will end; their practice results stay saved.</p><button id="school-set-password-submit" class="button primary" type="submit">Set password</button></form><p id="school-student-password-status" class="school-status" role="status"></p></dialog>`;
}

function schoolRunMarkup(run) {
  const title = escapeHtml(run.title), timing = run.meanAbsMs === null ? '' : ' · ' + Math.round(run.meanAbsMs) + ' ms average error · ' + schoolTiming(run.meanMs);
  const part = run.partName ? ' · ' + escapeHtml(run.partName) : '', take = run.takeId ? ' · Shared take ' + escapeHtml(run.takeId.slice(0,8)) : '';
  const missed = run.misses ?? run.total - run.hits;
  const breakdown = run.drums?.length ? '<details><summary>Timing by drum</summary><div class="school-drum-stats">' + run.drums.map(drum => '<span><b>' + escapeHtml(DRUMS.find(item=>item.id===drum.id)?.name || drum.id) + '</b> ' + drum.hits + '/' + drum.total + ' · ' + (drum.meanAbsMs === null ? 'No matched hits' : Math.round(drum.meanAbsMs) + ' ms avg. error · ' + schoolTiming(drum.meanMs)) + '</span>').join('') + '</div></details>' : '';
  return '<article class="school-run"><div class="school-run-heading"><div><h4>' + title + '</h4><small>' + schoolDate(run.at) + (run.stopped?' · Stopped':'') + ' · ' + Math.round(run.bpm) + ' BPM · Bars ' + escapeHtml(run.section) + ' × ' + run.repeats + part + take + '</small></div><button class="button secondary" data-open-run="' + escapeHtml(run.id) + '" aria-label="Open report for ' + title + '">' + Math.round(run.accuracy) + '% · Report</button></div><p>' + run.hits + '/' + run.total + ' matched · ' + missed + ' missed' + (run.wrong ? ' · ' + run.wrong + ' wrong notes' : '') + ' · ' + run.extras + ' extra · Best streak ' + run.bestStreak + timing + '</p>' + breakdown + '</article>';
}
