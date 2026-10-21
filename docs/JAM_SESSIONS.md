# Teacher led drum and keyboard sessions

Updated October 20, 2026. Proposed development after Prototype 10. Shared sessions and pitched keyboard practice are not implemented yet.

## First classroom test

Use one teacher computer and two student computers. Student A connects the Roland TD-17; Student B connects a MIDI keyboard. Each signs in to their own account and sees their assigned part. The teacher selects a duet, waits for both students to press Ready, then starts a shared count-in. Both students play at the same song position while the teacher sees their separate progress and results.

Keep configurable computer-keyboard controls for both instruments so every stage can be tested without the physical instruments. Begin with a short original duet: an eight-bar drum groove and a one-hand C-major melody at the same tempo. A keyboard-only MIDI controller can use a simple browser-generated tone; keyboards with their own sounds can use those instead.

Target Chrome on Windows or a Chromebook and verify that the actual keyboard exposes a MIDI input. Web MIDI requires a secure context and permission; a managed school browser can restrict it. MIDI carries musical events rather than the keyboard's audio. See the [Web MIDI guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) and [Web MIDI specification](https://webaudio.github.io/web-midi-api/).

For the first room test, play backing audio through one teacher-controlled classroom speaker. Student timelines and grading still run locally. Monitor drums and keyboard locally, with optional browser sounds. A headphone mode with backing on every device can follow after output latency is measured.

## Reuse from the current app

Reuse school accounts/rosters, published songs and immutable revisions, audio alignment, the Web Audio clock, keyboard bindings, timing reports, fullscreen controls and the existing drum views. A session layer will coordinate these features.

Some components need instrument support first:

- `dist/midi-input.mjs` accepts played note-on messages and maps pitches to drums. Separate device access from instrument interpretation. Preserve timestamps, pitch, channel and velocity, and add release events/held-key state for keys. Retain the drum adapter and pad learning.
- `dist/midi.mjs` already groups imported notes by track/channel and builds a tempo/meter timeline. It currently retains onsets, discards releases and makes drum charts. Extend it to keep pitched notes and durations and produce distinct drum/keyboard parts.
- `dist/engine.mjs` judges drum identity and timing. Add a keyboard judge for pitch and onset time with its own report fields. Piano notes must not become drums because their MIDI numbers overlap drum assignments.
- School publishing in `server/classroom.mjs` currently requires drum selections/mappings. Add versioned arrangement/part metadata while keeping existing songs valid as drum arrangements.
- The notation renderers engrave percussion. A keyboard piano-roll view comes first; pitched treble-clef notation follows the initial duet.

## Milestone sequence

Each milestone ends with a usable demonstration and checks before the next one. Simulated MIDI and computer keys support development; final acceptance needs the school hardware/network.

| Milestone | What we build | Completion check |
| --- | --- | --- |
| 1. Solo keyboard practice | Instrument/input selection, live key highlights, configurable computer keys, a simple keyboard note highway, optional synthesized sound and pitch/onset feedback | Play an original one-octave melody using MIDI or computer keys. Correct, wrong, early, late, missed and extra notes produce the intended feedback; existing drum practice still works. |
| 2. Separate song parts | Drum/keyboard parts sharing one timeline, backing alignment and song version; original duets; teacher MIDI track/channel assignment; publication of both parts together | Load one duet as drums, then keys. Notes differ while bars/tempo/duration/backing agree. Existing drum songs work without republishing; a drum-only MIDI does not acquire an invented keyboard part. |
| 3. Teacher room and readiness | Teacher creates a room, selects a duet, invites two students from their roster and assigns parts. Students choose their local inputs and press Ready after loading/checking sound | Teacher sees both accounts, parts and readiness. Start is unavailable while a student is unready, disconnected or using a different revision. Students cannot change the room transport. |
| 4. Shared start | Clock measurements, preloaded files, teacher Start, future scheduled count-in and shared song position. Teacher Stop/restart uses a fresh count-in | Both timelines follow the same take. Simulated network delay does not change local grades. Measure real start skew and drift on separate computers before classroom rollout. |
| 5. Live progress and reports | Separate drum/keyboard cards or lanes with position, accuracy, streak, misses, timing tendency and connection state; grouped session with individual reports | Teacher watches both performers and opens separate reports. Students retain their own histories. Reconnect/retried saving cannot duplicate results or mark an interrupted take completed. |
| 6. Classroom trial and recovery | Actual TD-17/keyboard tests, unplugging, Wi-Fi delay, hidden tabs, slow loading, teacher/server restart and migration/redeploy tests using synthetic data | Complete several duets, identify latency adjustments, retain school data/stats and show a clear state for each interruption. |

Order: **keyboard solo → shared song parts → teacher room → shared start → live results → classroom trial**. Milestones 1 and 2 provide useful keyboard practice before networking. Milestone 4 demonstrates simultaneous drum/keyboard playback; milestones 5 and 6 make it useful for teaching.

The earlier 2–4 developer-week estimate described two existing drum players. This scope also adds pitched input, keyboard rendering/scoring and publishing changes. Use these milestones as reviewable increments, without promised calendar dates or a fixed number of chat sessions. Reassess remaining effort after the solo keyboard and arrangement demonstrations.

## Keyboard scope

Start with one hand, one note at a time, a small range around middle C (MIDI note 60) and quarter/eighth-note rhythms. Display expected keys/received pitches with a consistent octave reference. Allow explicit range/octave settings and configurable computer keys; do not silently forgive wrong octaves.

Grade correct pitch and key-press timing. Retain release/duration data for display and future lessons, but leave hold length, pedal technique, dynamics and fingering outside the first pilot. Define wrong-note versus missed/extra-note matching so one mistake is not counted twice under misleading labels. Ignore computer-key auto-repeat and clear held keys/synth voices on blur, disconnect or Stop.

Handle note-off and zero-velocity note-on releases. Keep selected MIDI input/channel local to each computer and never silently substitute a different device after unplugging. Keep MIDI output/SysEx outside the pilot. Later lessons can add chords, held-note scoring, two hands, pedal behavior and explicit partial-credit rules. Treble-clef sheet music and a wrapped fullscreen keyboard score can follow the first duet. Preserve all three drum views and fullscreen controls throughout.

## Arrangements and library compatibility

An arrangement needs a stable ID/version, shared tempo/meter map, duration, backing reference/alignment and a list of parts. Each part has an ID, instrument, source tracks/channels and expected notes. Drums retain pad mappings; keys retain pitches/durations. Identify participants separately from instruments so two students can later play the same part.

Provide original duets of increasing difficulty, including sparse simultaneous beats for alignment checks and a longer repeated exercise for drift testing. Keep these fixtures in the repository without student data or commercial music.

For imports, teachers preview and explicitly assign tracks/channels. A percussion-only MIDI remains a valid drum song; mixed practice requires a provided duet or a MIDI with a keyboard part. Both parts use the same arrangement/backing alignment. Mismatched source arrangements need preparation instead of unrelated offsets during a take.

Version published metadata and portable song-setup files. Interpret existing records as drum-only arrangements. Validate both part types and preserve the old revision if publication fails. Editing creates a new revision; an active room retains its selected revision until a new take is prepared.

## Room timing and controls

Use a teacher-owned room with participant assignments and one transport. Suggested states: preparing, counting in, playing, completed, interrupted and closed. Give each take a fresh ID; duplicate/delayed commands cannot affect a different take. Lock arrangement revision, tempo, section and alignment when ready/playing; changes require preparation again.

Use authenticated WebSockets for room updates and clock measurements. Railway supports this transport; reconnection belongs in the app. Select a maintained server library during implementation. Start with one server instance: live rooms can be in memory, while finished takes/results persist. A server restart ends the active take clearly. See [Railway realtime transports](https://docs.railway.com/guides/sse-vs-websockets).

Each student presses Ready to activate local audio, preload files and confirm input. The teacher also enables audio on the speaker computer. Browser audio can require a user gesture; see [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

Measure clock offsets repeatedly with round trips, schedule a start in the future and map it to each local Web Audio clock. Measure device-clock drift, output latency and Wi-Fi jitter separately. Do not rely on a message arriving at the exact beat or silently jump the song/grading clock to hide drift.

Grade locally from native input timestamps on each student's chart timeline. Network arrival time never determines early/late grades. Send bounded progress batches roughly 4–10 times per second for teacher monitoring, without re-grading messages on arrival. Display connection/synchronization quality and refuse an unsafe start; do not promise sample-accurate playback over Wi-Fi.

Use the same count-in, section and position for both participants. Implement teacher Stop/restart first; synchronized pause/resume, seeking and loop changes can follow. Rejoining a take initially means waiting for the next one. Hidden tabs, lost audio or disconnected input must produce visible interruption rather than fabricated misses or automatic completion.

## Accounts and persistent results

Reuse school login and the teacher roster. Authorize account, room and part access for every command, including WebSocket handling; validate browser origin and the existing session/anti-forgery model. A room code alone cannot expose other students' history. Two tabs for one student should not create duplicate scored seats.

Persist session/take IDs, teacher, arrangement revision, participant assignment, completion state and result reference. Save each participant/take once. Include instrument/part in report filters, retaining drum detail and adding keyboard pitch/timing detail. Show separate scores rather than implying that different parts measure the same task. Keep passwords and an unbounded raw MIDI stream out of the teacher feed.

Before schema changes, preserve school identity, account/song/result counts and a private recovery copy. Use explicit additive migrations tested on synthetic existing schools. Update supported-schema checks in both `server/storage.mjs` and `server/classroom.mjs` deliberately; never reinitialize users/library. Keep the current Railway volume and [backup procedure](CLASSROOMS.md), and confirm hosted backups before classroom rollout.

## Acceptance checks

- Solo keyboard: MIDI/computer keys agree; wrong pitch/octave, releases, repeats and unplugging do not cause stuck voices or duplicate hits.
- Library: preserve tempo/meter, pitches/durations and shared alignment; old drum records continue working; invalid new imports preserve published songs.
- Rooms: correct teacher/two-student assignments, role isolation, expired/disabled accounts and duplicate joins are tested.
- Timing: clock offsets, variable delay, stale/out-of-order commands, slow decoding and drift cannot alter local grades or launch unready students.
- Reports: completed/stopped/interrupted states differ; save retries do not duplicate history; existing teacher/student privacy holds.
- Storage: migrate/restart/redeploy a synthetic school, verify identities/counts and recovery; never use real school data for destructive tests.
- Hardware: play short/long original duets using TD-17 and MIDI keys on separate computers. Measure start skew/drift against the teacher speaker, document an acceptable tolerance and resolve latency before broader use.

## Subsequent work

Add keyboard notation/chords/holds, more duet lessons, two students on the same part, headphone playback, assignments and a richer band overview. Keep part/input/judge interfaces reusable for MIDI bass/guitar controllers. Real guitar/bass audio recognition, vocals and remote live-audio streaming require separate milestones/equipment testing.
