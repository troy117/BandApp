# Groove Lab — development handoff

Updated October 22, 2026. This is the starting point for continuing at home.

## Where things stand

- Repository: https://github.com/troy117/BandApp — branch `main`.
- Browser app, version **0.12.0 / Prototype 12**. Browser modules in `dist/`; optional school backend in `server/`. No build step required. Run npm ci for the pinned ws server dependency. Node 24 is required for school SQLite storage.
- Teacher/student accounts, shared school songs and private student progress are implemented. On October 20 the user reported missing three songs/profiles, then created a new volume and a new teacher account. They confirmed mount /data and GROOVE_DATA_DIR=/data/groove-lab. An anonymous production check then confirmed enabled=true and setupNeeded=false. The old volume’s fate and scheduled/off-volume backups remain unverified. Keep the current volume attached; do not recreate the school on future code updates. See [CLASSROOMS.md](CLASSROOMS.md).
- Railway serves the app at https://bandapp-production-9386.up.railway.app/ . GitHub push and Railway deployment are separate facts. If a refresh still shows an older prototype, use Railway's **Deploy Latest Commit** for `main`; redeploying an old deployment may reuse its old code.
- School kit: **Roland TD-17 V-Drums**, now connected by USB to the user’s Windows computer running Chrome. Version 0.9 implements input; physical pad/latency validation is still pending user testing. Target Windows Chrome and ChromeOS.
- User explicitly wants GitHub/Railway. Do not register or publish a Codex Sites project.

## Full band follow-along

Prototype 12 adds guitar/bass string-fret highways and tab, vocal lyric display, MIDI lyric parsing plus LRC/VTT/SRT editing/import, and 1–8 assigned students per room (UI starts with two seats). Guitar/bass/vocals never produce performance scores; shared-take participation persists separately from numeric drum/keyboard runs. Existing explicit library assignments are retained; use Edit instrument parts to add new tracks. No schema or hosting variable changes. Read [GUITAR_BASS_VOCALS.md](GUITAR_BASS_VOCALS.md) for use, research sources, timing clocks, supported standard tunings and remaining milestones. The named Dreams file and physical classroom ensemble still require user testing.

## Teacher-set student passwords

Version 0.11.2 adds an optional password when creating students and a Set password roster dialog for existing students. Teacher-chosen passwords set must_change=0 so student practice and jam assignment work immediately. Blank create-password fields retain generated temporary passwords and first-login change; staff resets remain temporary. Student passwords require 4–128 characters and staff passwords 8–128, with one shared browser/server policy. Salted hashes, session revocation and roster ownership checks remain. Passwords are not stored in plain text or returned in roster/API responses; the teacher’s current submission is shown only for that visit. No schema/volume/variable changes.

## Piano tracks in library songs

Version 0.11.1 detects piano/keyboard track or instrument names and explicit General MIDI piano programs. Older school songs without instrument assignments expose detected piano alongside their saved drums on read; this does not rewrite the database, change the revision, replace files or change backing alignment. Explicit part assignments are respected. New publications store both detected parts. The library offers Practice keyboard and, for the publishing teacher/owner, Edit instrument parts. Edit loads the existing MIDI/backing/offset/speed/volume/drum map and publishes a new revision of that same song. Ambiguous tracks can be assigned manually; no piano part is generated from drums or an MP3.

The user specifically mentioned Fleetwood Mac-Dreams-04-28-2026. That exact MIDI is not in this local school database, so its track labels and hardware playback have not been verified. Tests use original synthetic duets. Keep the current Railway volume and variables; no schema change is needed.

## Run on the home computer

1. Clone this repository, or download and extract its ZIP. The repository root contains `package.json` (there is no extra `groove-lab` source subfolder in GitHub).
2. Install Node.js 24 LTS if needed. Open a terminal in the repository folder.
3. Run `npm ci`, then `npm run dev` and open http://localhost:4173/ . The server now uses the pinned ws package; the standalone browser file remains dependency-free.
4. For a single offline file, run `npm run standalone`, then open `artifacts/Groove Lab.html` in Chrome or use **Open Groove Lab.cmd**. Regenerate the standalone after changes. It is ignored in Git.
5. Run `npm test`, `npm run check`, and `npm run standalone` before pushing changes.

Start the next coding conversation with: “Read docs/HANDOFF.md, docs/CONVERSATION.md and docs/JAM_SESSIONS.md, inspect the current code and Git state, and continue Groove Lab.” The conversation record contains the available user requests and clarifications; DISCUSSION_LOG.md records decisions. No private school database or music belongs in GitHub.

## What travels between computers

GitHub includes app source, tests, licensing, and these notes. It does **not** include accounts, passwords, the school database, published music, imported device songs, recordings, screenshots, browser practice history, or saved keyboard controls. No Fleetwood Mac recording or Songsterr MIDI is bundled. School data lives in the configured persistent storage directory and is ignored by Git.

For a song already aligned at school, choose **Download song setup** in its import/setup dialog. Take that JSON plus the original MIDI and MP3 through your own file-transfer method. At home import those files, then **Load song setup** to restore the part selection, mapping, offset, MIDI speed, and volume. The exact MIDI fingerprint is checked. Save it in the home browser library for future visits. Browser libraries are separate per device, browser profile, and website origin; localhost and Railway also have separate libraries.

## Completed milestones

1. Keyboard drum prototype: rebindable controls, synthesized sound, shared audio clock, count-in, highway, signed early/late feedback, final report and CSV.
2. MIDI import and backing audio: GM drum selection/mapping, original test files, local audio decoding, song library with save/archive/restore, Railway-ready server.
3. Notation and hit cues: sheet/highway toggle, moving playhead, colored note heads, drum/key legend, highway hit boxes.
4. Practice tools: 24 original tracks in four levels, section repeats, focus, built-in tempo ladder, per-pass reports, slower retry, next track, local journal.
5. Song alignment and imported notation: automatic candidates, waveform, short audio/MIDI previews, manual one/two-point fit, MIDI speed scaling, portable setup JSON, imported rhythms/tuplets/meter changes. Version 0.6.1 adds colored MIDI-hit overlays, separate drum rows, and click-to-select MIDI beats on the recording waveform.
6. Classroom system: school owner creates teachers, teachers create students without email, one shared school song library, per-account run history and teacher roster/results, device-to-school publishing, password resets/disable, private persistent storage and backup/recovery tools. The user confirmed teachers should see their own students' results and share one school library.
7. Full-sheet practice: entire score wraps into rows with a moving gold play bar and row following, using the same MIDI clock. All library songs open directly with saved settings; live backing volume is on the practice screen and detailed setup is separate. Removed the large intro banner. Keyboard controls and all three views remain available during a run.
8. Full-screen score: corner icon expands the full-sheet view, with Play/Stop, Listen first and exit controls inside the score. Row spacing tightens to use the screen. Escape exits without changing playback; scored completion exits before showing the report. Embedded browsers retain a viewport-filling fallback.
9. USB drumkit input: opt-in device permission, selected input only, TD-17/default drum note assignments, live note/strength feedback, Learn pad for rims/edges, ignored notes, local mapping/sound preferences, unplug handling and reconnect. Kit hits use the existing timestamped scoring path; all views and keyboard controls remain available. No MIDI output or SysEx access. [Setup guide](DRUMKIT.md).

10. Storage safety and fullscreen everywhere: mounted-volume containment, school identity marker and optional deployment identity pin, intentional first-setup flag, SQLite integrity/schema checks, private consistent database recovery copies per app version, owner-only storage diagnostics and clear school-write blocking if storage is wrong. Highway/horizontal sheet/full sheet all maximize with shared transport, an internal view selector and sheet legends.

11. Keyboard and shared practice: Keyboard/Jam navigation, selected MIDI keyboard/channel, configurable computer keys and octave, a piano note highway, pitch/onset judge and CSV, three original duets, published instrument arrangements, teacher rooms, readiness, clock measurement/shared count-in, live progress and grouped individual reports. Rooms are in memory; completed/interrupted take states and finished results persist. See the classroom test guide before claiming verified hardware synchronization.

## How sync works

The convention is `recordingSeconds = originalMidiSeconds * timeScale - offsetSeconds`. A positive offset delays the recording; a negative offset skips its intro. The UI's MIDI speed percentage is `100 / timeScale`.

`alignMidiChart` scales note, beat, measure and signature times and inversely scales BPM. Quarter-note coordinates remain unchanged. The recording always plays at normal speed and pitch. `createPracticeChart` then selects/repeats the adjusted chart; `backingSegments` crops the corresponding original recording region on each pass. Preview and play use the same audio clock.

`waveformNotes` projects original MIDI hits onto this same recording axis for the sync overlay. The waveform, markers, bar lines and pointer selection share plot bounds including the drum-label gutter. Selecting a row marker sets MIDI bar/beat and the currently aligned recording position; clicking the audio waveform changes only the recording position. Alignment is applied explicitly with **Apply beat match**. Simultaneous hits retain one x coordinate and appear on separate rows. Display toggling/zoom does not change alignment or scoring.

Automatic analysis uses a lightweight multiband energy novelty envelope sampled at 100 Hz, then a weighted onset comparison with the selected MIDI drums. It searches offsets and, optionally, a small duration ratio, returning up to three alternatives for review. Processing yields to the browser and can be cancelled by closing setup. No model, API call, upload, network service, or source separation is involved. A constant duration fit is deliberately the current limit. Similar repeated bars, sparse/drumless mixes, expressive playing, and different arrangements can fool onset matching. Do not label candidates as verified or display an invented accuracy percentage.

Imported notation uses musical quarter positions and per-measure meter. Standard subdivisions, triplets and 32nds are engraved in one combined rhythm voice. Display quantization never changes expected hit times. It is a scrolling staff with a synced playhead, not a replica of Songsterr's multipage engraving, lyrics, articulations or original drum voicing.

## Code map

| File | Responsibility |
| --- | --- |
| `dist/app.mjs` | Main UI, session lifecycle, rendering, grading/report integration |
| `dist/engine.mjs` | Drum definitions, bindings, builtin charts, judge, CSV |
| `dist/lessons.mjs` | 24 original graded practice tracks |
| `dist/audio.mjs` | Web Audio clock, synthesized drums, bounded recording playback |
| `dist/midi.mjs` | MIDI parsing, tempo/meter map, GM mapping, musical measures |
| `dist/sync.mjs` | Alignment math, MIDI retiming, audio features and candidate search |
| `dist/audio-sync.mjs` | Sync UI, waveform, previews, candidate/manual application |
| `dist/notation.mjs` | Shared notation model and scrolling canvas staff |
| `dist/song-import.mjs` | Import/setup, portable JSON, saved-song UI |
| `dist/full-score.mjs` | Wrapped score layout, visible-row drawing and playback following |
| `dist/midi-input.mjs`, `drumkit-controls.mjs` | Web MIDI connection lifecycle, note parsing, local pad learning and live controls |
| `dist/score-screen.mjs` | Fullscreen/viewport expansion, transport controls and keyboard focus |
| `dist/song-library.mjs` | IndexedDB song metadata and original file bytes |
| `dist/practice.mjs`, `practice-tools.mjs` | Sections, repeats, focus, progress, curriculum UI |
| `scripts/serve.mjs` | Static server, Railway PORT support, healthcheck |
| `server/storage.mjs` | Volume/path/identity/integrity checks, pre-version database recovery copies and safe initialization |
| `dist/instruments.mjs`, `arrangements.mjs`, `piano-audio.mjs` | Pitched input/judge, clock estimation, shared song parts and local keyboard voices |
| `dist/band-practice.mjs`, `band-rooms.mjs`, `band-link.mjs`, `band-import.mjs` | Solo keyboard, session UI/network, and duet import/publishing |
| `server/band-sessions.mjs`, `band-results.mjs` | Authorized WebSockets/rooms, take/result persistence and additive schema migration |
| `server/classroom.mjs` | SQLite, authenticated accounts/roles, sessions, shared music uploads, private progress APIs |
| `dist/classroom.mjs`, `classroom.css` | School sign-in, roster, account controls and progress views |
| `scripts/backup-school.mjs`, `reset-school-owner.mjs` | Private consistent backup and administrator owner recovery |
| `scripts/standalone.mjs` | Dependency-free single HTML export; add new modules/styles here |

## Next milestone plan

1. **Run the real classroom trial.** Read [BAND_TESTING.md](BAND_TESTING.md). Milestones 1–5 have software implementations in 0.11: solo keyboard, multi-part arrangements, teacher rooms/readiness, a scheduled shared start, live progress and separate/grouped saved results. Use the TD-17 and MIDI keyboard on separate computers, plus a teacher computer and one backing speaker. Physical timing/driver behavior and school-network reliability remain unverified.
2. **Keep storage and verify the hosted update.** Use the existing Railway volume/path/account, one replica and Node 24; the package install must include ws. The 0.11 recovery copy is taken before the additive schema-2 migration. Confirm school identity, songs, accounts and a saved result after deployment. Do not recreate the school or volume. Confirm scheduled/off-volume backups separately.
3. **Resolve classroom findings before broad rollout.** Measure start skew/drift, pad variants, keyboard range, local sound duplication and any per-device timing correction. An interrupted take is not a completed score. Restart/deploy ends active rooms; saved accounts, songs and finished takes remain.
4. **Then expand keyboard teaching.** Add treble-clef/fullscreen keyboard notation, chord/hold grading, two hands/pedals and more duet lessons. All three drum views already work in the pilot. MIDI guitar/bass adapters and real guitar/vocal audio recognition remain separate milestones.
5. **Later transport and solo refinements.** Add synchronized pause/seek/loop controls, expressive notation, assignments/login cards/exports and PWA after timing has been validated. Keep timestamped local scoring and current privacy boundaries.

## Storage implementation notes

Production checks run before a writable ClassroomStore opens. A wrong/missing Railway mount, database/owner absence, integrity error, identity mismatch or unsupported newer schema disables school APIs with an explanation while solo practice and public health remain available. Read the server's SCHOOL STORAGE PROTECTION log for the actual cause; the public API intentionally does not expose private paths/errors.

Existing populated 0.7–0.9 schools are adopted without an initialization flag or schema reset. A genuinely new hosted school requires GROOVE_ALLOW_NEW_SCHOOL=1 just until owner creation. Local development still initializes synthetic schools normally. Do not manually define Railway's automatic RAILWAY_VOLUME_MOUNT_PATH variable. Database schema is now 2. server/band-results.mjs adds band_takes and band_results in one transaction. The supported version is shared by the store and storage guard. Older app code refuses the newer schema; do not downgrade the running database in place.

The per-version recovery SQLite is created once before opening the existing database for normal app writes. Always bump package/package-lock versions for a release. Existing copies are checked and preserved, with sessions/drafts omitted. They remain on the same volume and do not duplicate music; a wiped volume needs an independent complete backup. No backup rotation or restoration is automatic. Read CLASSROOMS.md before any restore and stop the live app first.

## Validation and limitations

Prototype 12: all 120 tests pass, with syntax and standalone export checks. New coverage includes a five-student shared take across persistence/restart, scored versus unscored results, all instrument assignments, piano-plus-lyrics detection, timed-text formats, tempo/backing clocks, fret placement and finite rendering geometry. Browser QA verifies guitar tab playback, lyric progression, five teacher assignments and publication of a retained full-band school revision. No real school accounts or songs were used.

Prototype 11 validation: 105 tests passed, with module syntax and standalone export checks. The new tests cover pitched MIDI/releases, input timestamps, remapping, shared arrangements, clock estimation, room permissions/readiness/stale messages, separate idempotent results, restart/interruption and additive migration. Browser trials cover a teacher with two simulated performers, then a student browser with a simulated teacher/drummer; the student report saved under the shared take. Browser checks also cover mapping persistence, fullscreen/Escape, original two-part MIDI publication and drum notation. These are software checks rather than a three-computer physical audio test. Fullscreen coverage includes denied/pending native requests, browser exit, focus/keyboard behavior, compact row spacing and the embedded transport. Coverage includes full-score row boundaries and clock alignment, bounded canvas size and row following, direct library application for teachers/students/guests, live backing gain changes, classroom permissions/persistence, and existing sync, scoring, notation and loops. Browser QA verifies all three views, keyboard scoring after switching, saved-song loading, live volume, detailed setup and narrow screens using original demo music. Classroom QA uses isolated synthetic accounts. MIDI tests use simulated input ports and DOM controls for permissions, parsing, pad learning/persistence, reconnect, cancellation and timestamped scoring. The in-app browser leaves MIDI permission pending, so its connection request was cancelled through Disconnect; Chrome permission and real USB input still need the user’s hardware check. Storage tests preserve two accounts and three real demo-MIDI publications across restarts, verify recovery contents, and reject bad mounts, missing/replaced databases, wrong identities, corrupt data and future schemas. Browser checks verify new fullscreen views/selector/keyboard scoring, Escape behavior, owner-only diagnostics and the protected-storage error screen. No real school credentials, student records or music were accessed in QA. Physical-kit input, scheduled backups, old-volume recovery and a hosted post-deploy account/result round trip are not verified. See CHANGELOG.md for release verification.

Conceptual references: [Web Audio recording slices](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start), [librosa onset strength](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html). Our simple energy novelty implementation is original and does not bundle librosa or claim its spectral-flux implementation.

Password update validation: 113 automated tests, module syntax and standalone export passed. Backend tests use isolated synthetic schools and cover creation, teacher-set/reset passwords, short-password login, jam assignment, restart, retained results and permission failures. Browser-client tests cover request data, field clearing and accurate password help. The live browser check was blocked by the browser URL policy; no real account passwords were changed during testing.
