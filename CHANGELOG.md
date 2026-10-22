# Changes

## 0.11.1 — October 22, 2026 — Prototype 11.1

- Detect piano/keyboard track and instrument names plus explicit General MIDI piano programs, including program changes on another track of the same channel. Leave ambiguous guitar/bass/unidentified tracks unassigned; explicit instrument assignments win.
- Older school songs without part metadata expose their detected piano alongside their saved drums in the library, keyboard practice and teacher session catalog. Detection reads the retained MIDI without replacing files, changing song/revision identity or rewriting existing records. New publications store the detected instrument parts.
- Practice keyboard opens the actual piano part. Publishing teachers/owners can Edit instrument parts using the existing MIDI, backing, offset, speed, volume and drum map, then publish a revision of the same song. Existing files and practice results remain.
- Validation: **110 tests pass**, syntax and standalone export pass. Coverage includes older-library detection, program/channel timing, explicit assignments, end-to-end imported-song two-student start/results, song revisions and backing preservation, and library action routing. Browser QA verifies detected piano practice, retained settings, revision publication and separate drum/piano session seats with isolated synthetic accounts and original music. The exact Dreams MIDI and physical instruments have not been verified locally.

## 0.11.0 — October 21, 2026 — Prototype 11

- Solo MIDI keyboard practice: selected input/channel, held-key feedback, configurable computer keys and octave, optional synthesized tones, keyboard note highway/fullscreen, pitch/onset timing judge, wrong-note feedback, per-note report and CSV. Releases and computer repeat suppression are distinct from drum input.
- Three original drum-and-keyboard duets and versioned published arrangements with explicit track/channel assignments, shared tempo/meter/backing alignment and portable setup JSON. Existing drum songs still work; the drum editor retains keyboard parts when updating mixed arrangements. Keyboard staff/chord/hold/pedal grading remains future work.
- Teacher-owned rooms invite two existing students and assign their parts. Audio/input readiness and clock measurements precede a future shared count-in. Teacher Start, Stop/prepare-next-take and Close controls; each performer is graded locally from native timestamps.
- Live teacher performer cards, individual school histories and recent grouped takes. Completed results save idempotently. Lost input, hidden tabs, expired sessions, duplicated tabs, stale commands and server restarts have explicit interrupted/rejoin states.
- Additive schema-2 migration for take/result tables after the existing recovery-copy check. School identity, accounts, published music and legacy results are retained. Active rooms are temporary; completed and interrupted take records persist. Server requires the pinned MIT-licensed ws dependency via npm ci; browser/standalone have no downloaded runtime package.
- Validation: **105 tests pass**, module syntax and standalone export checks pass. Browser QA uses synthetic accounts/original music: teacher starts two simulated performers, then a keyboard student browser follows a simulated teacher/drummer and saves a shared report. Verified key remapping across refresh, fullscreen/Escape continuity, MIDI publication and drum notation. Real TD-17/keyboard drivers, three-computer audible synchronization, school Wi-Fi and the hosted post-deploy round trip still require the classroom trial in [BAND_TESTING.md](docs/BAND_TESTING.md). Production accounts and music were not used in QA.

## 0.10.0 — October 20, 2026 — Prototype 10

- Fullscreen for **Note highway**, **Sheet music** and **Full sheet**. The embedded Play/Stop/Listen toolbar adds a View selector; switching preserves the run and keyboard/MIDI timing. Sheet legends remain inside fullscreen. Escape returns to the page without stopping playback.
- School storage is checked before opening a writable database: the configured path must be inside Railway's attached volume, school identity must match its marker/optional environment pin, and SQLite integrity/schema checks must pass. An absent/ownerless production database needs an explicit new-school initialization flag; existing schools retain their owner/data.
- Consistent private database recovery copy before each new app version, retaining the original copy across restarts. Copies omit active sessions/drafts, stay on the same volume and do not copy music. Independent backups remain necessary. Bad storage pauses school APIs and clearly explains the problem while individual practice remains available.
- Owner-only school storage/recovery panel, revised Railway setup and recovery guide, conversation record, discussion/handoff updates and a scoped shared jam-session plan. A teacher-led two-drummer session is the proposed next milestone, not a feature in this release.
- Validation: **88 tests pass**, module syntax and standalone export pass. Coverage includes three published demo songs/two accounts across updates, recovery-copy consistency, bad mounts, replacement/missing/corrupt databases, school identity and future-schema rejection, API permissions and safe write blocking. Browser QA covers fullscreen views/transport, live switching, scored keyboard input, Escape and owner storage diagnostics using synthetic data. Actual hardware input, hosted backup schedules and recovery of the old volume remain unverified.

## 0.9.0 — October 20, 2026 — Prototype 09

- USB MIDI drumkit input in supported secure browsers, with an explicit Connect drumkit action, permission guidance, input picker and live pad/note/strength readout. Default mappings include common drum notes and Roland hi-hat variants; Learn pad adds rims/edges or moves a note to a different drum. Individual notes can be ignored and defaults restored.
- Local device/mapping/sound preferences are separate from keyboard and song-import controls. App drum sounds for kit hits default off for use with the module's sounds. Keyboard/on-screen controls and every practice view continue using the same timestamped judge; MIDI velocity affects optional app sound volume, not grading.
- Selected-device disconnect stops the run; reconnect restores that device without substituting other MIDI inputs. Cancelled permission/open requests cannot reopen a disconnected input. MIDI releases, clock, controllers and choke messages do not create false strikes. No MIDI output or SysEx access.
- TD-17 setup/troubleshooting guide and updated development handoff/discussion log. Physical pad/latency and Chrome permission validation remain for the user's Windows/TD-17 test; the in-app browser keeps MIDI permission pending, with a usable Disconnect cancellation.
- Validation: **80 automated tests pass**, module syntax and standalone export checks pass. Browser checks cover the connection panel, cancellation, mapping controls/preferences, keyboard practice and panel layout. MIDI hardware tests use simulated ports; no physical-kit verification is claimed.

## 0.8.1 — October 20, 2026 — Prototype 08.1

- Full-screen icon for **Full sheet**, with a compact **Play/Stop**, **Listen first**, song title and exit toolbar. The score uses the available screen width/height and tighter row spacing. Browsers that deny native fullscreen still maximize within the page viewport.
- Keyboard scoring and the existing audio clock continue through entry/exit. Escape leaves full screen; stopping and starting use the existing transport. Completed scored runs leave full screen before opening the report.
- Keyboard focus stays within the expanded score, exit restores the page, and fullscreen requests that finish after cancellation cannot reopen it.
- Validation: **69 automated tests pass**, module syntax and standalone export pass. Browser checks cover fullscreen entry/exit, transport, a scored keyboard hit, report display and responsive layout using original exercises/demo music.

## 0.8.0 — October 20, 2026 — Prototype 08

- Third practice view: **Full sheet** wraps the entire score into rows, with a moving gold play bar and automatic row following during playback. Built-in/imported songs, loops, focus, tempo changes, meters and keyboard scoring share the existing timing model. Long scores draw only visible rows on a viewport-sized canvas.
- Device and school library songs open directly into practice with saved mappings, backing audio and sync settings. Teachers/guests can open **Edit song setup** separately.
- Live backing-volume slider beside the loaded song; volume changes apply to current/scheduled backing slices without restarting the song or changing synthesized drums.
- Removed the **Find your pocket** intro banner, moved practice directly below the header, and let the full-sheet view use the page width. Short scores use less vertical space.
- Validation: **63 automated tests pass**, syntax check and standalone export pass. Browser checks cover wrapped built-in/imported scores, keyboard scoring after live view switches, direct saved-song loading, live volume changes, reopening detailed setup and a 390-pixel layout. Original demo files only; the user's Dreams MIDI/recording and TD-17 hardware were unavailable.

## 0.7.0 — October 19, 2026 — Prototype 07

- School owner and teacher accounts; teachers create student usernames without email and see their own students' practice results. The owner can create teachers and assign new students to them.
- Temporary passwords with required first-sign-in change, password reset and disable/re-enable controls; permission checks, private sessions, CSRF protection and password hashing on the server.
- One shared school library containing MIDI, optional backing audio, drum mappings and alignment. Teachers can publish existing device songs and update their own school songs; students practice published versions in both views with keyboard controls.
- Completed account runs persist with hits/misses/extras, streak, tempo, section/repeats/focus, early/late tendency and drum timing summaries. Results retry after a failed save; account switching clears the previous account's screen and report. Guest history remains separate.
- Private SQLite/music storage on one persistent Railway volume, bounded authenticated uploads, atomic publication, archived songs, consistent backup and administrator owner recovery tools. Production does not enable accounts without a configured data directory.
- Railway activation guide, updated discussion log and development handoff. Actual hosted activation still needs the volume and variables in `docs/CLASSROOMS.md`; no real accounts or student data were created during development.
- Validation: **56 tests pass**, syntax check and standalone export pass. Isolated browser checks cover owner/student login, temporary password flow, teacher publishing, student song playback and completed result saving, reload persistence, guest/account switching, teacher reports, device-to-school publishing and narrow-screen layout. Synthetic accounts and original demo music only; TD-17 hardware remains untested.

## 0.6.1 — October 16, 2026 — Prototype 06.1

- Colored MIDI drum-hit overlays on the audio waveform, with separate rows and a legend for simultaneous drums.
- Click a drum-row marker to select its MIDI bar/beat, then click the corresponding audio attack and apply the beat match. A readout names the selected drums and their current recording timestamp.
- Markers follow offset, MIDI speed, zoom, and drum mappings on a shared recording-time axis. The overlay can be hidden to inspect audio alone.
- Validation: **51 tests pass**, syntax check and standalone export pass. Browser checks cover marker selection, audio matching, nudges, overlay toggle, and responsive layout.

## 0.6.0 — October 16, 2026 — Prototype 06

- Local backing-audio analysis with up to three reviewable MIDI alignment candidates; offset and optional small duration-ratio search.
- Waveform, recording-only and combined eight-second previews, bar/beat-to-recording matching, optional second match for steady drift, and 50 ms nudges.
- MIDI speed adjustment (50–200%) without changing backing audio pitch/speed. Internal tempo changes, count-in, loop slices and grading remain aligned.
- Imported MIDI sheet music with the shared scrolling playhead, drum/key legend, rests, tuplets, 32nds, changing meter, partial measures, loops and focus. Exact MIDI times remain unchanged by notation display rounding.
- Local song library and per-song preferences retain MIDI speed alongside offset/mappings/volume; older saved entries default to 100%.
- Download/load portable song setup JSON, with exact MIDI fingerprint validation. Audio/MIDI files travel separately.
- Added development handoff, discussion/decision log, next-milestone plan and updated README.
- Validation: **50 automated tests pass**, plus module syntax check and standalone export. Browser checks with original sample files covered suggestions, manual start/drift matching, previews, saved alignment after reload, setup JSON download/restore, MIDI-only speed changes, focused loops, live view switching, keyboard strikes and the completed report. Actual user song recordings and TD-17 hardware remain to be tested.

## 0.5.0 — October 15, 2026 — Prototype 05

- 24 original exercises across four difficulty levels.
- Selected-bar practice loops, one/two/four/eight passes, drum focus and built-in tempo ladder.
- Per-pass reports, slower retry, next-track action, local journal and source-bar/pass CSV columns.
- Expanded drum notation for toms, cymbals, rests and sixteenths.
- Commit: `c312294bc252f77e901c7e43ae1d58193ac782bb`.

## Earlier prototypes

- Browser keyboard drum practice, configurable key mappings and synthesized sounds.
- GM MIDI import, drum mapping, backing audio, original samples, browser song library and Railway-ready serving.
- Built-in sheet/highway toggle, moving playhead, hit boxes and grouped strike cues.
