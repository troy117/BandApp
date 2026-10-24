import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function backupSchool(sourceDirectory, outputDirectory) {
  const source = path.resolve(sourceDirectory), output = path.resolve(outputDirectory);
  const relative = path.relative(source, output);
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) throw new Error('Put the backup outside the live school data directory.');
  await access(path.join(source, 'school.sqlite'));
  await mkdir(output, { mode: 0o700 }); // A new folder is required; never replace an existing backup.
  await mkdir(path.join(output, 'music'), { mode: 0o700 });
  const live = new DatabaseSync(path.join(source, 'school.sqlite'), { readOnly: true });
  try { await backup(live, path.join(output, 'school.sqlite')); } finally { live.close(); }
  const snapshot = new DatabaseSync(path.join(output, 'school.sqlite'));
  try {
    // Published files are immutable. Taking the DB snapshot first lets us copy
    // exactly its referenced versions even while teachers publish newer songs.
    snapshot.exec("PRAGMA foreign_keys=ON; DELETE FROM sessions; DELETE FROM revisions WHERE state='draft'; DELETE FROM songs WHERE revision_id IS NULL;");
    const revisions = snapshot.prepare("SELECT id,audio_expected,metadata FROM revisions WHERE state='published'").all();
    for (const row of revisions) for (const kind of ['midi',...(JSON.parse(row.metadata).backingTracks ? JSON.parse(row.metadata).backingTracks.map(track=>'audio-'+track.id) : row.audio_expected ? ['audio'] : [])]) await copyFile(path.join(source, 'music', `${row.id}.${kind}`), path.join(output, 'music', `${row.id}.${kind}`));
    const manifest = { version: 1, createdAt: new Date().toISOString(), schoolId: snapshot.prepare("SELECT value FROM settings WHERE key='school_id'").get()?.value, accounts: snapshot.prepare('SELECT COUNT(*) AS n FROM users').get().n, attempts: snapshot.prepare('SELECT COUNT(*) AS n FROM runs').get().n, songVersions: revisions.length };
    snapshot.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    await writeFile(path.join(output, 'backup.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    return manifest;
  } finally { snapshot.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.env.GROOVE_DATA_DIR, output = process.argv[2];
  if (!directory || !output) throw new Error('Set GROOVE_DATA_DIR and run: node scripts/backup-school.mjs <new-private-backup-folder>');
  const summary = await backupSchool(directory, output);
  console.log(`Private school backup created: ${summary.accounts} accounts, ${summary.attempts} attempts, ${summary.songVersions} song versions. Keep this folder private.`);
}
