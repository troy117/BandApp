import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { ClassroomStore } from '../server/classroom.mjs';

const directory = process.env.GROOVE_DATA_DIR;
if (!directory) throw new Error('Set GROOVE_DATA_DIR to the existing school data directory.');
await access(path.join(directory, 'school.sqlite'));
const store = await ClassroomStore.open(directory);
try {
  const owner = store.db.prepare("SELECT id,username FROM users WHERE role='owner'").get();
  if (!owner) throw new Error('There is no school owner to recover. Use the first-time setup screen.');
  const password = `drum-${randomBytes(12).toString('base64url')}`, hash = await store.passwords.hash(password);
  store.transaction(() => { store.db.prepare('UPDATE users SET password_hash=?,must_change=1 WHERE id=?').run(hash, owner.id); store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(owner.id); store.audit(owner, 'owner.recovery', owner.id); });
  console.log(`Owner username: ${owner.username}\nTemporary password: ${password}\nSign in and choose a new password. Keep these details private.`);
} finally { store.close(); }
