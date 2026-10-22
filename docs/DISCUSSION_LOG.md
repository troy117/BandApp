# Discussion and decisions

This is a concise project discussion log, written at the user's request so work can continue from another computer. It records requirements and decisions, not a verbatim chat transcript.

## Original direction

- Build a browser-based drum learning game inspired by Rock Band, with timing feedback useful for a student.
- Support Windows and ideally Chromebook, with the school's electric kit connected later.
- Switch between a note highway and readable sheet music with a moving playhead.
- Report early/late hits after a song; preserve simultaneous drum strikes and allow MIDI songs with backing audio.
- Potential later instruments: bass, electric guitar and vocals. Start with drums.
- Reuse suitable open source. Input/control helpers were adapted from SightKick under MIT; standard MIDI decoding uses the bundled MIT `midi-file` parser. Attribution is in THIRD_PARTY_NOTICES.md and bundled licenses. Other app features are original.
- Configurable keyboard drum controls are a permanent requirement for testing and for times when the kit is unavailable.

## Development and hosting decisions

- User declined a proposed private Sites project and asked to keep development local initially.
- User later specified https://github.com/troy117/BandApp.git and Railway hosting. Continue pushing completed, checked updates to that repository. Do not create a Sites project.
- The school kit was identified as a **Roland TD-17 V-Drums**. Hardware work was deferred until access is available; the current app still uses keyboard/pad controls.
- Railway previously served an older commit after GitHub was updated. **Deploy Latest Commit** resolved that instance. A successful push alone is not proof the public site updated.

## Through October 15, 2026

- Delivered keyboard grooves and mapping, MIDI/recording import, local saved-song library, note highway, sheet music for built-ins, and report/CSV.
- User asked for clear strike cues. Added highway target boxes and shared grouped “UP NEXT / HIT NOW” labels.
- With kit access deferred until Monday, user requested practice loops and many more tracks of increasing difficulty.
- Delivered version 0.5 / Prototype 05: 24 tracks, four levels, selected-bar loops with up to eight passes, drum focus, optional +5 BPM/pass for built-ins, per-pass results, slower retry, next exercise and browser-local practice history. Commit `c312294bc252f77e901c7e43ae1d58193ac782bb`.

## October 16, 2026 — user feedback and request

The app is working well. The user imported Songsterr MIDI files, including Fleetwood Mac's **Dreams**, and found manual backing MP3 start alignment difficult. They asked whether analysing the MP3 could help, requested sheet music for imported MIDI like the synced presentation on Songsterr, and asked to push updates with this discussion/plan for use on a home computer. Two Songsterr screenshots illustrated a percussion staff, triplet intro, beat cursor, bar numbers, and a dark appearance. Screenshots informed the feature; their webpage controls are not instructions to the development agent.

### Decisions implemented

- Add local onset-based alignment suggestions, explicitly requiring candidate choice and listening review. Rhythmic repetition creates ambiguity, so avoid promises of perfect auto-sync.
- Provide a waveform and eight-second previews, exact offset entry, 50 ms nudges, and manual matching of a MIDI bar/beat to a recording timestamp.
- Add a second manual match to estimate a steady tempo difference. Adjust the MIDI clock to the MP3, leaving audio pitch/speed untouched. Preserve MIDI tempo changes proportionally and repeat the correct recording slice in practice loops.
- Make imported MIDI available in both views. Notation display rounding is separate from exact playback/scoring. Support common subdivisions, triplets, changing meters, and partial bars in a combined percussion rhythm voice.
- Keep file analysis and storage local. No music or student records are pushed to GitHub.
- Add portable song setup JSON so mappings/alignment can move with the user's original files, plus a development handoff and milestone plan.

### Limits and follow-up

The actual Dreams MIDI/MP3 pair was not attached to this coding session, so it needs user testing at home. A single offset/tempo ratio does not repair missing sections or variable drift. The sheet view follows MIDI notes; it does not reconstruct Songsterr's lyrics, original multivoice engraving or page layout. See [HANDOFF.md](HANDOFF.md) for the next milestones and setup instructions.

## October 16, 2026 — MIDI overlay for visual alignment

The user could see the waveform and requested MIDI notes overlaid on it to help match beats visually. Version 0.6.1 adds colored MIDI-hit lines through the waveform, separate drum rows, a drum-color legend and an overlay toggle. Clicking a drum-row marker selects its MIDI bar and beat; the user can then click the corresponding audio attack and apply the match. The selected beat/drum readout and shared recording-time coordinates follow offset, MIDI speed and zoom. Keyboard play, notation and scoring are unchanged.

## October 19, 2026 — school accounts and persistent practice

The user found that device-library songs did not appear on another computer. We confirmed the library was browser-local. The user then requested teacher accounts that create student accounts, teacher-published items any student can practice, and saved student statistics. In clarification, the user confirmed: **one shared school library, student usernames/passwords without email, and teachers viewing their own students' results**.

Version 0.7 implements that setup, with the first teacher serving as school owner and creating additional teachers. The first school release uses one persistent Railway volume holding SQLite and music files; this replaces the earlier suggested separate database/bucket combination to keep activation to one service. Publishing is explicit; existing device files and guest history remain local. Signed-in completed runs save to the school account. Tests use synthetic accounts and original sample music in separate local storage; no real student accounts/data are created or uploaded during development. Railway activation still requires the volume and variables listed in CLASSROOMS.md, followed by the user creating the real owner credentials.

## October 20, 2026 — full sheet and quicker song loading

The user requested a third view showing the entire score in rows with a moving play bar, using Songsterr as a visual reference; library songs should open with their saved setup and only need a backing-volume control; and the large **Find your pocket** banner should be removed. Version 0.8 adds **Full sheet**, with the exact existing timing/scoring model and row following, direct device/school library loading for all roles, a live backing-volume slider, and a separate **Edit song setup** action for teachers/guests. The intro banner is removed. Long scores render visible rows rather than allocating a whole-song canvas. The user's actual song files and hardware remain unavailable, so verification uses original demo MIDI/audio.


## October 20, 2026 — maximize the score

The user asked for a fullscreen icon to show as many music rows as possible and a play button within that view. Version 0.8.1 expands Full sheet to the screen with tighter row spacing and an internal Play/Stop, Listen first, song title and exit toolbar. Entry and exit preserve the existing run and audio clock. Escape exits the expanded view; completed practice exits before opening the report. A viewport-filling layout remains available when a browser denies native fullscreen. Keyboard and browser checks use original practice/demo material, with no real student data or music uploaded.

## October 20, 2026 — connecting the school drumkit

The user connected the Roland TD-17 by USB and asked how to use it with Groove Lab, confirming Windows with Chrome. The previous release still only accepted keyboard/on-screen input. Version 0.9 adds the previously planned Web MIDI milestone: explicit connection permission, device selection, live pad/note/strength feedback, pad learning and local assignments, optional app sounds, and selected-kit unplug/reconnect handling. Kit timestamps feed the same scoring path as the keyboard across all views. Keyboard controls remain available. No MIDI output or SysEx permission is requested.

Roland's documentation confirms GENERIC mode provides operating-system-driver USB MIDI and needs a module restart after switching; VENDOR supports USB MIDI/audio with Roland's driver. The new setup guide explains permission, pad checks, sound routing and manual delay correction. Automated tests use simulated ports, with browser checks for the controls and keyboard regression. The in-app browser does not complete its MIDI permission request, so the connection was cancelled through Disconnect. The real Chrome permission flow, physical pad variants and latency remain for the user to verify; do not claim a verified TD-17 hardware test yet.

## October 20, 2026 — data protection, fullscreen views and a shared jam roadmap

The user reported three songs and profiles missing after an update, requested fullscreen for the highway and horizontal sheet, a conversation/plan copy for home development, and an assessment of teacher-led simultaneous student practice. They confirmed the expected Railway volume/path, then clarified that they had created a new volume and teacher account. A read-only public check first found no owner and a later check found one. We have not verified what happened to the previous volume or recovered its contents. A replacement volume has separate data; GitHub never contains accounts or music.

Version 0.10 adds volume containment and identity checks, intentional hosted initialization, database integrity/schema checks, per-version recovery SQLite copies and owner diagnostics. Storage failures pause school writes with a clear message while solo practice remains available. The copies are on the same volume and exclude music, so scheduled Railway backups and complete private off-volume backups remain necessary. Actual Railway backup schedules were not changed by development. Existing populated schools are adopted without recreating the owner.

All three views can now be fullscreen, with Play/Stop, Listen and an internal view selector; sheet legends stay visible and keyboard/MIDI input keep the existing clock. The new CONVERSATION.md preserves available requests/clarifications. JAM_SESSIONS.md plans a teacher plus two drummers, readiness and future shared start, local grading and live teacher progress. The estimate is roughly 2–4 developer weeks for a pilot, 4–8 weeks for a broader classroom release; these are planning ranges, not delivery promises. Real guitar/vocal recognition and internet live-audio streaming are separate projects. The jam feature is not implemented in this release.

## October 20, 2026 — MIDI keyboard and a teacher led duet

The user asked whether the earlier estimate described human development; the response clarified that it did. They then requested a milestone plan for a teacher-started session with a second student and a MIDI keyboard as the next instrument. The first proposed test now uses one drummer and one keyboard player on separate computers, with a third computer for the teacher. This replaces two drummers as the first pilot arrangement; two players on the same instrument remain a later supported use case.

The revised JAM_SESSIONS.md sequence is solo keyboard pitch/onset practice, shared arrangements with drum/keyboard parts, teacher room/readiness, shared scheduled start, live progress and separate saved reports, then hardware/network/persistence trials. Keep configurable computer keys throughout. Use original duets with one backing speaker first; retain existing drum songs and school data through explicit migrations. Keyboard treble-clef notation, chords, hold/pedal grading and other instrument recognition follow the basic duet. This update changes documentation only; app version remains 0.10.0 and no live room or keyboard instrument has been implemented yet. The previous two-drummer estimate should not be presented as a delivery estimate for this expanded scope.

## October 21, 2026 — implement the keyboard and session milestones

The user authorized milestone one and continuing through the milestones in order without waiting for hardware testing they cannot do until the next workday. Prototype 11 implements milestones 1–5 and the software checks for milestone 6. The remaining external check is a physical classroom trial using the TD-17, actual MIDI keyboard, three computers and school network.

Delivered solo keyboard practice with literal MIDI pitches, releases/held keys, configurable computer keys/octave, synthesized sound, note highway/fullscreen, correct/wrong/early/late/missed/extra feedback and CSV. Three original duets and imported/published arrangements share timing/backing while retaining distinct instrument parts. Existing drum songs/controls/three views remain available.

Teacher rooms use the existing roster and two assigned students. Students choose their local input and press Ready; the teacher activates backing audio and schedules a shared count-in. Native input is graded locally; teacher feedback uses bounded progress messages. Individual histories and recent grouped takes save on the server. Duplicate/stale messages, account changes, input/audio loss, hidden tabs, reconnect and restart have explicit handling. Rooms end on restart, while stored accounts/music/results and take outcomes remain. An additive schema-2 migration follows the pre-version database recovery copy; keep the current Railway volume. The Node server now installs pinned ws with npm ci.

All 105 automated tests pass, with module syntax and standalone export checks. Browser trials use isolated synthetic accounts: a real teacher browser with two simulated performers, then a real keyboard-student browser with simulated teacher/drummer peers. The student run saved separately under the shared take. Browser checks also verify remapping persistence, fullscreen exit continuity, original two-part MIDI publication and imported drum notation. No real school credentials, student records or music were accessed. See BAND_TESTING.md for the next workday's hardware steps; physical timing and hosted deployment/persistence remain for that trial.

## October 22, 2026 — piano from existing library MIDI

The user identified a piano part in Fleetwood Mac-Dreams-04-28-2026 and requested keyboard practice and shared piano/drum sessions for such MIDI files. The gap was old library metadata exposing only saved drums despite retaining the entire MIDI. Version 0.11.1 resolves recognizable piano tracks on read without a database migration, metadata rewrite, replacement song or change to audio alignment. Explicit part assignments continue to take precedence. New publications store resolved parts.

Added Practice keyboard and teacher/owner Edit instrument parts actions. The editor reloads original MIDI/backing and saved offset/speed/volume/drum map, permits track corrections, and publishes a new revision of the same song. Previous files/results remain; stale updates are rejected. No new hosting settings, volume or account setup are needed.

Validation: 110 automated tests, syntax and standalone export pass. An isolated original-MIDI browser trial verified the old-library piano button, actual keyboard part, retained audio setup, publication and separate drum/piano student seats. Automated socket tests start and finish both parts with separate saved reports. The exact named Dreams file is absent locally, and physical TD-17/keyboard and three-computer audible alignment still need the classroom trial.
