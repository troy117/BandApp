import test from 'node:test';
import assert from 'node:assert/strict';
import { SchoolClient } from '../dist/classroom.mjs';

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
