import test from 'node:test';
import assert from 'node:assert/strict';
import { SchoolClient, classroomRoster } from '../dist/classroom.mjs';

function client() {
  const nodes = new Map();
  const el = id => { if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: false, close() {}, showModal() {} }); return nodes.get(id); };
  const school = Object.assign(Object.create(SchoolClient.prototype), { el, user: { id: 'teacher', role: 'teacher' }, roster: [], beforeOpen() {}, loadRoster: async () => {} });
  return { school, el };
}

test('teacher-set credentials skip first-login instructions and clear password fields after sending', async () => {
  const {school,el}=client(),requests=[];
  school.request=async(route,options)=>{requests.push({route,data:options.data});return {user:{id:'student',username:'student',role:'student',mustChangePassword:false}};};
  el('school-student-name').value='Student';el('school-student-username').value='student';el('school-student-password').value='beat';
  await school.createUser();assert.equal(requests[0].data.password,'beat');assert.equal(el('school-student-password').value,'');
  assert.equal(el('school-credential-label').textContent,'Password');assert.match(el('school-credential-help').textContent,/No password change required/);
  school.openStudentPassword({id:'student',name:'Student',username:'student',role:'student'});el('school-set-password').value='new4';
  await school.setStudentPassword();assert.equal(requests[1].route,'/users/student/reset-password');assert.equal(requests[1].data.password,'new4');assert.equal(el('school-set-password').value,'');
  school.request=async()=>{throw new Error('Could not save');};el('school-student-password').value='beat';await school.createUser();assert.equal(el('school-student-password').value,'');
});

test('temporary credentials and student/staff password help describe the actual sign-in policy', () => {
  const {school,el}=client();school.showCredentials({user:{username:'student',mustChangePassword:true},temporaryPassword:'temporary'});
  assert.equal(el('school-credential-label').textContent,'Temporary password');assert.match(el('school-credential-help').textContent,/first sign-in/);
  school.user={role:'student'};school.openPassword();assert.equal(el('school-new-password').minLength,4);assert.match(el('school-password-help').textContent,/4–128/);
  school.user={role:'teacher'};school.openPassword();assert.equal(el('school-new-password').minLength,8);assert.match(el('school-password-help').textContent,/8–128/);
});

const roster = [
  { id: 'a', name: 'Student 10', username: 'Singer', role: 'student', active: true, defaultInstrument: 'vocals', attempts: 0, recentAccuracy: null, lastPractice: null },
  { id: 'b', name: 'Student 2', username: 'keys', role: 'student', active: true, defaultInstrument: 'keyboard', attempts: 7, recentAccuracy: 0, lastPractice: 100 },
  { id: 'c', name: 'Alex', username: 'alex', role: 'student', active: false, defaultInstrument: 'vocals', attempts: 9, recentAccuracy: 85, lastPractice: 300 },
  { id: 'd', name: 'Teacher', username: 'teacher', role: 'teacher', active: true, defaultInstrument: 'vocals', attempts: 2, recentAccuracy: 96, lastPractice: 200 },
];

test('class roster combines name/username, instrument and account filters without changing the source roster', () => {
  const original = structuredClone(roster);
  assert.deepEqual(classroomRoster(roster).map(user => user.id), ['b', 'a', 'd']);
  assert.deepEqual(classroomRoster(roster, { query: ' SINGER ', instrument: 'vocals' }).map(user => user.id), ['a']);
  assert.deepEqual(classroomRoster(roster, { instrument: 'vocals', status: 'all' }).map(user => user.id), ['c', 'a']);
  assert.deepEqual(classroomRoster(roster, { status: 'inactive' }).map(user => user.id), ['c']);
  assert.deepEqual(classroomRoster(roster, { query: 'unknown' }), []);
  assert.deepEqual(classroomRoster(roster, { sort: 'recent' }).map(user => user.id), ['d', 'b', 'a']);
  assert.deepEqual(classroomRoster(roster, { sort: 'accuracy' }).map(user => user.id), ['d', 'b', 'a']);
  assert.deepEqual(classroomRoster(roster, { sort: 'attempts' }).map(user => user.id), ['b', 'd', 'a']);
  assert.deepEqual(roster, original);
});

test('compact roster preserves account actions, zero scores, escaped names, counts and empty states', () => {
  const { school, el } = client(); school.roster = [{ ...roster[1], name: '<Student & "2">' }, roster[2], roster[3]];
  school.resetRosterFilters(); school.renderRoster();
  const html = el('school-roster').innerHTML;
  assert.match(html, /<table/); assert.match(html, /&lt;Student &amp; &quot;2&quot;&gt;/);
  assert.match(html, /0%/); assert.match(html, /data-instrument-user="b"/);
  assert.match(html, /data-action="progress"/); assert.match(html, /data-action="set-password"/); assert.match(html, /data-action="reset"/);
  assert.equal(el('school-roster-count').textContent, '2 of 3 accounts shown');
  assert.equal(el('school-roster-summary').textContent, '1 active student · 1 teacher · 1 inactive');
  assert.equal(el('school-roster-clear').hidden, true);
  el('school-roster-search').value = 'nobody'; school.renderRoster();
  assert.match(el('school-roster').innerHTML, /No accounts match/); assert.equal(el('school-roster-clear').hidden, false);
  school.resetRosterFilters(); el('school-roster-status').value = 'inactive'; school.renderRoster();
  assert.match(el('school-roster').innerHTML, /Enable account/);
});

test('failed default instrument changes restore the saved choice and re-enable the selector', async () => {
  const { school, el } = client(); school.roster = structuredClone(roster);
  const selector = { value: 'bass', disabled: false };
  el('school-roster').querySelector = () => selector;
  school.request = async () => { assert.equal(selector.disabled, true); throw new Error('Connection unavailable'); };
  await school.setInstrument('a', 'bass');
  assert.equal(selector.value, 'vocals'); assert.equal(selector.disabled, false);
  assert.equal(school.roster[0].defaultInstrument, 'vocals');
  assert.equal(el('school-dashboard-status').textContent, 'Connection unavailable');
});
