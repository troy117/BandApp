# Teacher accounts, school songs and student progress

Version 0.7 / Prototype 07 · October 19, 2026

## What this release does

- One shared school library. Teachers publish MIDI, optional backing audio, drum mapping and alignment together. Every signed-in student can practice those songs on any computer using the same school website.
- The first teacher is the **school owner**. The owner can create teachers, assign students to a teacher, and view school results.
- Teachers create student usernames without email addresses. Teachers see their own roster and their students' results. They can reset temporary passwords and disable/re-enable accounts without deleting history.
- Students can see their own results and practice all published songs and the 24 built-in tracks. Students cannot publish/archive school songs, create accounts, or view other students' results.
- Completed scored runs save match rate, hits/misses/extras, streak, tempo range, section/passes/focus, timing window, signed early/late tendency, average absolute error and timing by drum. Listen mode and stopped runs do not save attempts.
- The homepage shows recent account history; **School sign in → My practice results** opens paginated full history. Teachers use **Open classroom → Results** for a student.
- Device songs and guest practice still work without signing in. They remain local until a teacher explicitly publishes a song. Old guest attempts are not assigned to a student automatically.

## Activate on Railway

The new code needs persistent storage; GitHub alone does not hold accounts or music. This first school release uses one Railway service with SQLite and immutable music files on one persistent volume. It does not require an external database or object-storage provider. Keep the service at **one replica**; a larger deployment can later move to Postgres and object storage.

1. Open the existing BandApp service in Railway. Attach a **persistent volume** with mount path **`/data`**. Choose capacity with room for music, the database and backups; the app defaults to a 1 GiB music quota. Volume storage is billed by Railway. See [Railway volumes](https://docs.railway.com/volumes).
2. Add these **service variables**:

   | Variable | Value |
   | --- | --- |
   | `GROOVE_DATA_DIR` | `/data/groove-lab` |
   | `GROOVE_PUBLIC_ORIGIN` | `https://bandapp-production-9386.up.railway.app` (no trailing slash; change if using a custom domain) |
   | `GROOVE_SETUP_TOKEN` | A private random setup key of at least 24 characters |
   | `GROOVE_STORAGE_MB` | Optional; `1024` by default. Keep below the volume capacity to leave database space. |

   Generate a private setup key on your own computer with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Paste it into Railway Variables and keep it private. It is not a student login. Do not put it in GitHub or chat.
3. Keep the start command **`npm start`**, Node **24.x**, healthcheck **`/healthz`**, and one service replica. Deploy the latest commit.
4. Open the HTTPS school website. The footer should show **Prototype 07**. Choose **School sign in**, enter the setup key, and create your own teacher username and password. This creates the school owner. First-time setup closes permanently after that account exists.
5. Open **classroom** and create the other teachers/students. New accounts receive a generated temporary password, shown at creation. Copy/share that login directly; the user chooses their own password on first sign-in. Names can be first names or nicknames. Passwords/passphrases need at least 15 characters.
6. Enable scheduled volume backups in Railway's **Backups** tab and retain a private copy of the original music. Backups and owner recovery are described below.

Without `GROOVE_DATA_DIR`, production keeps serving guest practice and device libraries, but school accounts are disabled with a setup explanation. It never silently creates a temporary production database. With a data directory configured, missing/invalid production setup configuration stops startup so an incorrectly configured school does not appear ready.

## Publish existing songs

On the original computer and website address where the songs were saved:

1. Sign in as a teacher.
2. Open **Song library → This device**.
3. Choose **Publish to school** on each song you want to share. This uploads the actual MIDI/audio and the saved mapping/alignment. The device copy remains available.
4. Open **School library** to verify the published song.

For new songs, use **Import song**, adjust the part/sync, set the **School song title**, and choose **Publish to school**. Use **Update school song** after loading a song you manage. Other teachers can publish their own copy; they cannot overwrite someone else's songs. The school owner can manage all songs.

An update is published only after its files finish uploading and its MIDI/mapping validate. Students continue seeing the previous complete version until then. Archiving hides a song from student downloads; restoring brings it back. Existing practice history is retained. Archive and updates retain published file versions, so they do not reclaim disk space. The current app intentionally has no permanent-delete UI.

File limits remain 10 MB MIDI, 100 MB backing audio, 20-minute adjusted songs and 50,000 mapped hits. There are at most five unfinished uploads per teacher. Cancelled uploads are cleaned up when possible; stale drafts are removed after 24 hours on startup or the next upload. Published music and old versions count toward the configured school music quota.

## Results and shared computers

- Sign in before starting. The account at the start of a run owns that result. Changing accounts stops the run and clears the old report, downloaded song and displayed account history.
- Signed-in results are stored on the server rather than in the guest browser journal. Signing out restores guest history and clears school result screens.
- Look for **Results saved to your school account** after finishing. If saving fails, the result remains in memory with a retry button and retries when connectivity returns. Keep the page open until it saves. A reload can lose unsaved results; do not assume a failed upload is saved. The API uses unique run IDs so retrying does not duplicate a completed attempt.
- Recent roster averages include the last 30 attempts. Inspect the song, focus, tempo and timing window before comparing attempts. The full result history is paginated rather than limited to those 30 summaries.
- Sign out on shared computers. Sessions expire after an hour without requests or eight hours total. Password changes, teacher resets and disabling an account revoke existing sessions. Keyboard controls and latency settings remain device-specific.

## Local development

`npm run dev` binds to localhost and enables school accounts in the ignored **`.groove-data/`** folder. First-time local setup does not need a setup key. For an isolated test school, set `GROOVE_DATA_DIR` to a new private folder before starting. Do not use real student data in test fixtures. Only the localhost development command allows the local setup shortcut and non-Secure development cookie.

The single-file offline export still supports guest practice/device songs. School features need the hosted application or local Node server; they do not work across computers from an offline HTML file.

## Backups and recovery

The live data directory contains **`school.sqlite`** and **`music/`**. Treat the whole directory and its backups as private school data; neither belongs in GitHub. The app does not send passwords or student data to logs.

Besides Railway volume snapshots, an administrator with server filesystem access can make a consistent private backup:

```sh
node scripts/backup-school.mjs /path/to/new-private-backup-folder
```

Set `GROOVE_DATA_DIR` first. The command requires a new output folder outside the live data directory. It snapshots SQLite before copying its referenced immutable published music, excludes unfinished uploads and active sessions, and includes a small backup manifest. Keep a complete private copy outside the running service. Test a restore in a separate environment first. To restore, stop the app, point it at a restored backup directory, and restart with the correct hosting variables. Users sign in again. Do not overwrite a running database.

If the **school owner** loses their password, an administrator with Railway/server access can run:

```sh
node scripts/reset-school-owner.mjs
```

This uses `GROOVE_DATA_DIR`, revokes that owner's sessions, and prints a new temporary password in that private terminal. The owner must choose a new password at sign-in. Teacher/student resets are available through their manager's classroom screen. There is no email password-recovery service.

## Implementation and scope

`server/classroom.mjs` implements persistence and authenticated APIs. `dist/classroom.mjs` supplies sign-in, roster and results screens; the song importer supplies school/device library controls. This is one school per deployment, with a shared library and teacher-specific student rosters.

Passwords use salted scrypt (`N=131072,r=8,p=1`), following the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Sessions use random tokens hashed in SQLite, HttpOnly/SameSite cookies, Secure cookies on HTTPS production, and per-session CSRF tokens. Permission checks are enforced by the API, not just hidden buttons. Uploads are authenticated, streamed with size/quota limits, and stored outside public files. Practice statistics are browser-measured feedback, not a verified examination system. No grades, assignments, parent portal, student email, hardware MIDI or cross-school tenancy are added in this release.
