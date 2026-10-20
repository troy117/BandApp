# Groove Lab — development handoff

Updated October 20, 2026. This is the starting point for continuing at home.

## Where things stand

- Repository: https://github.com/troy117/BandApp — branch `main`.
- Browser app, version **0.8.1 / Prototype 08.1**. Browser modules in `dist/`; optional school backend in `server/`. No downloaded runtime dependencies or build step required. Node 24 is required for school SQLite storage.
- Teacher/student accounts, shared school songs and private student progress are implemented. **Railway still needs the persistent-volume/account configuration in [CLASSROOMS.md](CLASSROOMS.md).** Do not claim cloud accounts are live until that setup and a hosted sign-in/save check succeed.
- Railway serves the app at https://bandapp-production-9386.up.railway.app/ . GitHub push and Railway deployment are separate facts. If a refresh still shows an older prototype, use Railway's **Deploy Latest Commit** for `main`; redeploying an old deployment may reuse its old code.
- School kit: **Roland TD-17 V-Drums**, to be tested when accessible on Monday. Continue keyboard testing until then. Target Windows Chrome and ChromeOS.
- User explicitly wants GitHub/Railway. Do not register or publish a Codex Sites project.

## Run on the home computer

1. Clone this repository, or download and extract its ZIP. The repository root contains `package.json` (there is no extra `groove-lab` source subfolder in GitHub).
2. Install Node.js 24 LTS if needed. Open a terminal in the repository folder.
3. Run `npm run dev` and open http://localhost:4173/ . No `npm install` is needed for the current dependency-free app.
4. For a single offline file, run `npm run standalone`, then open `artifacts/Groove Lab.html` in Chrome or use **Open Groove Lab.cmd**. Regenerate the standalone after changes. It is ignored in Git.
5. Run `npm test`, `npm run check`, and `npm run standalone` before pushing changes.

Start the next coding conversation with: “Read docs/HANDOFF.md and docs/DISCUSSION_LOG.md, inspect the current code and Git state, and continue Groove Lab.” These files are a project handoff, not hidden conversation memory.

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
| `dist/score-screen.mjs` | Fullscreen/viewport expansion, transport controls and keyboard focus |
| `dist/song-library.mjs` | IndexedDB song metadata and original file bytes |
| `dist/practice.mjs`, `practice-tools.mjs` | Sections, repeats, focus, progress, curriculum UI |
| `scripts/serve.mjs` | Static server, Railway PORT support, healthcheck |
| `server/classroom.mjs` | SQLite, authenticated accounts/roles, sessions, shared music uploads, private progress APIs |
| `dist/classroom.mjs`, `classroom.css` | School sign-in, roster, account controls and progress views |
| `scripts/backup-school.mjs`, `reset-school-owner.mjs` | Private consistent backup and administrator owner recovery |
| `scripts/standalone.mjs` | Dependency-free single HTML export; add new modules/styles here |

## Next milestone plan

1. **Activate the classroom release.** Follow CLASSROOMS.md to add a Railway volume, set the public origin and private setup key, create the real school owner, enable backups, and publish existing device songs. Then validate real teacher/student access from separate computers. Classroom data must stay out of GitHub.
2. **Roland TD-17 input.** Add Web MIDI feature detection and a device/port picker in Chrome; learn pads by striking them, show velocity/mapping feedback, and funnel timestamps into the existing judge. Handle reconnect and permissions. Keep keyboard and on-screen pads fully available. Validate actual kit latency and hi-hat/cymbal variants on hardware before claiming support.
3. **Pause, seek and section navigation.** Add stopped-position seeking in the score/highway, resume with an optional count-in, and clickable measure selection for loops. Keep backing slices, expected notes, and grading time consistent; interrupted runs should not be mistaken for full-song scores.
4. **Notation refinements.** Consider separate hands/feet voices, expressive flams, ghost notes, articulations, printable/wrapped pages, and a configurable display grid. Preserve exact scoring times.
5. **Optional advanced alignment.** If real songs show variable drift, consider piecewise anchor maps or beat tracking/dynamic alignment. Require reviewable local results and correct section-boundary scheduling. Do not silently warp a different arrangement.
6. **Validate real songs and plan classroom refinements.** Check the user's Dreams MIDI/MP3 near the start and end, then an early/late loop in both views. Record the exact setup and troublesome bars; those files were unavailable during development. Later: assignments, printable login cards, optional progress exports and a PWA; bass/guitar/vocals remain future work.

## Validation and limitations

All 69 tests pass, with module syntax and standalone export checks. Fullscreen coverage includes denied/pending native requests, browser exit, focus/keyboard behavior, compact row spacing and the embedded transport. Coverage includes full-score row boundaries and clock alignment, bounded canvas size and row following, direct library application for teachers/students/guests, live backing gain changes, classroom permissions/persistence, and existing sync, scoring, notation and loops. Browser QA verifies all three views, keyboard scoring after switching, saved-song loading, live volume, detailed setup and narrow screens using original demo music. Classroom QA uses isolated synthetic accounts. This release has no hardware MIDI or hosted classroom activation test. See CHANGELOG.md for release verification.

Conceptual references: [Web Audio recording slices](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start), [librosa onset strength](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html). Our simple energy novelty implementation is original and does not bundle librosa or claim its spectral-flux implementation.
