# Groove Lab — development handoff

Updated October 20, 2026. This is the starting point for continuing at home.

## Where things stand

- Repository: https://github.com/troy117/BandApp — branch `main`.
- Browser app, version **0.10.0 / Prototype 10**. Browser modules in `dist/`; optional school backend in `server/`. No downloaded runtime dependencies or build step required. Node 24 is required for school SQLite storage.
- Teacher/student accounts, shared school songs and private student progress are implemented. On October 20 the user reported missing three songs/profiles, then created a new volume and a new teacher account. They confirmed mount /data and GROOVE_DATA_DIR=/data/groove-lab. An anonymous production check then confirmed enabled=true and setupNeeded=false. The old volume’s fate and scheduled/off-volume backups remain unverified. Keep the current volume attached; do not recreate the school on future code updates. See [CLASSROOMS.md](CLASSROOMS.md).
- Railway serves the app at https://bandapp-production-9386.up.railway.app/ . GitHub push and Railway deployment are separate facts. If a refresh still shows an older prototype, use Railway's **Deploy Latest Commit** for `main`; redeploying an old deployment may reuse its old code.
- School kit: **Roland TD-17 V-Drums**, now connected by USB to the user’s Windows computer running Chrome. Version 0.9 implements input; physical pad/latency validation is still pending user testing. Target Windows Chrome and ChromeOS.
- User explicitly wants GitHub/Railway. Do not register or publish a Codex Sites project.

## Run on the home computer

1. Clone this repository, or download and extract its ZIP. The repository root contains `package.json` (there is no extra `groove-lab` source subfolder in GitHub).
2. Install Node.js 24 LTS if needed. Open a terminal in the repository folder.
3. Run `npm run dev` and open http://localhost:4173/ . No `npm install` is needed for the current dependency-free app.
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
| `server/classroom.mjs` | SQLite, authenticated accounts/roles, sessions, shared music uploads, private progress APIs |
| `dist/classroom.mjs`, `classroom.css` | School sign-in, roster, account controls and progress views |
| `scripts/backup-school.mjs`, `reset-school-owner.mjs` | Private consistent backup and administrator owner recovery |
| `scripts/standalone.mjs` | Dependency-free single HTML export; add new modules/styles here |

## Next milestone plan

1. **Verify storage and backups on the current school.** Keep the new volume/service/environment/path. After Prototype 10 deploys, the owner opens School storage & recovery, confirms the same accounts/songs, sets GROOVE_EXPECTED_SCHOOL_ID and leaves GROOVE_ALLOW_NEW_SCHOOL removed. Enable scheduled Railway volume backups and keep a complete private off-volume copy. Perform a harmless saved-result/redeploy check. Do not claim old data was recovered or that backups were enabled by this chat.
2. **Finish physical TD-17 validation.** USB input and learning are implemented; verify real pad/rim/edge/hi-hat variants, unplug/replug, backing routing and timing in Windows Chrome. Keep keyboard testing. Physical-kit behavior has not been verified by development tools.
3. **Add solo MIDI keyboard practice.** The user selected keys as the next instrument for testing two performers. Separate MIDI device access from drum mapping; add pitched notes, release handling, a keyboard note highway, simple browser sound and configurable computer-key testing. Begin with single notes around middle C and grade pitch/onset time. This is planned, not implemented in 0.10.
4. **Build the drum-and-keyboard jam pilot.** Follow [JAM_SESSIONS.md](JAM_SESSIONS.md) in order: versioned song arrangements with separate parts, a teacher room with one drummer and one keyboard player on separate computers, readiness, future shared start/count-in, local timestamped grading, then live teacher progress and grouped individual reports. Use an original duet and one teacher backing speaker first. Preserve existing drum-only songs and school data with explicit migrations. The earlier two-drummer estimate does not cover all of the new keyboard work.
5. **Harden the pilot.** Measure real start skew/drift with the TD-17 and MIDI keyboard, test reconnects, hidden tabs, slow decoding, role isolation and saved results. Begin with one classroom backing source. Do not promise remote live-audio performance or grade hits by packet arrival time.
6. **Expand parts/instruments deliberately.** Add keyboard treble-clef/fullscreen notation, chords, held-note scoring and more duet lessons after the first shared test. Keep instrument adapters reusable for MIDI bass/guitar; real guitar/bass/vocal audio recognition needs its own equipment, research and validation milestone.
7. **Later solo refinements.** Pause/seek and clickable measure navigation, expressive/multiple-voice notation, optional variable-drift alignment, assignments/login cards/exports and PWA. Validate real song arrangements before promising alignment accuracy.

## Storage implementation notes

Production checks run before a writable ClassroomStore opens. A wrong/missing Railway mount, database/owner absence, integrity error, identity mismatch or unsupported newer schema disables school APIs with an explanation while solo practice and public health remain available. Read the server's SCHOOL STORAGE PROTECTION log for the actual cause; the public API intentionally does not expose private paths/errors.

Existing populated 0.7–0.9 schools are adopted without an initialization flag or schema reset. A genuinely new hosted school requires GROOVE_ALLOW_NEW_SCHOOL=1 just until owner creation. Local development still initializes synthetic schools normally. Do not manually define Railway's automatic RAILWAY_VOLUME_MOUNT_PATH variable. Database schema is currently 1; change supported-version checks intentionally with any future migration.

The per-version recovery SQLite is created once before opening the existing database for normal app writes. Always bump package/package-lock versions for a release. Existing copies are checked and preserved, with sessions/drafts omitted. They remain on the same volume and do not duplicate music; a wiped volume needs an independent complete backup. No backup rotation or restoration is automatic. Read CLASSROOMS.md before any restore and stop the live app first.

## Validation and limitations

All 88 tests pass, with module syntax and standalone export checks. Fullscreen coverage includes denied/pending native requests, browser exit, focus/keyboard behavior, compact row spacing and the embedded transport. Coverage includes full-score row boundaries and clock alignment, bounded canvas size and row following, direct library application for teachers/students/guests, live backing gain changes, classroom permissions/persistence, and existing sync, scoring, notation and loops. Browser QA verifies all three views, keyboard scoring after switching, saved-song loading, live volume, detailed setup and narrow screens using original demo music. Classroom QA uses isolated synthetic accounts. MIDI tests use simulated input ports and DOM controls for permissions, parsing, pad learning/persistence, reconnect, cancellation and timestamped scoring. The in-app browser leaves MIDI permission pending, so its connection request was cancelled through Disconnect; Chrome permission and real USB input still need the user’s hardware check. Storage tests preserve two accounts and three real demo-MIDI publications across restarts, verify recovery contents, and reject bad mounts, missing/replaced databases, wrong identities, corrupt data and future schemas. Browser checks verify new fullscreen views/selector/keyboard scoring, Escape behavior, owner-only diagnostics and the protected-storage error screen. No real school credentials, student records or music were accessed in QA. Physical-kit input, scheduled backups, old-volume recovery and a hosted post-deploy account/result round trip are not verified. See CHANGELOG.md for release verification.

Conceptual references: [Web Audio recording slices](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start), [librosa onset strength](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html). Our simple energy novelty implementation is original and does not bundle librosa or claim its spectral-flux implementation.
