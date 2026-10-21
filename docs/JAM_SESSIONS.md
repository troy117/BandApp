# Teacher led drum and keyboard sessions

Updated October 21, 2026 for Prototype 11.

## Milestone status

The software for milestones 1–5 is implemented. Automated tests and browser trials use synthetic school accounts, original music, simulated MIDI and computer keys. Milestone 6 needs the actual TD-17, MIDI keyboard, student computers and school network. Use [BAND_TESTING.md](BAND_TESTING.md) for that trial before treating physical synchronization as verified.

| Milestone | Delivered in Prototype 11 | Remaining check |
| --- | --- | --- |
| 1. Solo keyboard practice | Keyboard area, MIDI input/channel selection, C4–C5 computer-key mapping with octave controls, illuminated keys, note highway/fullscreen, optional synthesized sound, pitch/onset grading and timing CSV | Actual keyboard permission, driver, range and local sound setup |
| 2. Separate song parts | Three original duets; drum/keyboard charts on one timeline; explicit MIDI track/channel assignments; shared backing offset/speed/volume; portable arrangement setup and teacher publication; old songs remain drums | Try the school's own multi-track MIDI and matching recordings |
| 3. Teacher room and readiness | Existing roster/account permissions, two student assignments, invitations, part loading, local input selection, audio activation and Ready checks | Sign in on the actual three computers and verify inputs |
| 4. Shared start | Measured clock offsets, future shared count-in, teacher Start/Stop/prepare-next-take and timestamped local grading | Measure audible start skew and drift on school equipment |
| 5. Live progress and reports | Separate performer cards; position, hits/misses/wrong/extra/streak/timing; individual school histories; teacher's recent grouped takes; idempotent result saves | Review two real students' completed and interrupted takes |
| 6. Classroom trial and recovery | Software tests cover role isolation, duplicated tabs, stale commands, delays, interruption, expired sessions, restart, additive migration and recovery | Physical kits/keys, Chrome/Chromebook, Wi-Fi, unplug/replug, audio routing and hosted redeploy round trip |

Start with one teacher computer, one student on the TD-17 and another on MIDI keys, each with a separate school login. The teacher chooses Together on one, assigns parts and waits for both students. Each presses Ready; the teacher enables the classroom speaker and starts one count-in. Students see their own music and retain separate results.

Use one audible backing source on the teacher computer for the first classroom test. Provided duets use a synthesized guide; published arrangements use their saved backing recording when present. Students monitor their instruments locally. A MIDI controller without sounds can use app tones. Configurable computer keys remain available for every step.

## Implementation and reuse

- `dist/instruments.mjs` provides pitched-message parsing, saved keyboard controls, the pitch/onset judge and low-round-trip clock estimation. `dist/midi-input.mjs` retains selected-port connection/reconnect behavior and accepts a keyboard parser without changing drum mapping semantics.
- `dist/midi.mjs` now retains note releases and durations. `dist/arrangements.mjs` creates separate drum/keyboard charts from tracks/channels using the same tempo, meter, alignment and song version. No keyboard part is invented from a drum-only file.
- `dist/band-practice.mjs`, `band-markup.mjs`, `band.css` and `piano-audio.mjs` supply the practice UI, local sound, shared-time input/report path and fullscreen. Existing solo drum views remain; the session drum part also supports highway, sheet and full sheet. Keyboard staff notation comes later.
- `dist/band-import.mjs` publishes arrangements through the existing private song upload system. A failed new revision leaves published music intact. The legacy drum editor preserves keyboard parts when updating a mixed song.
- `dist/band-link.mjs` and `band-rooms.mjs` handle browser connections, invitations, readiness, live progress, saved-result confirmation and grouped teacher history.
- `server/band-sessions.mjs` uses the maintained, pinned ws package for authenticated WebSockets on the existing server. `server/band-results.mjs` adds two tables in an explicit schema-2 transaction and validates/stores results. Existing school identities, songs and prior runs are preserved.

The Node server requires npm ci after pulling this release. The browser remains buildless, and the generated standalone HTML supports local solo drums/keys without the server package. Accounts, school songs and shared sessions require the hosted app/server.

## Keyboard teaching scope

The first provided melody uses one hand and single notes around middle C (MIDI note 60, displayed as C4). Grade pitch and key-press timing. A wrong note consumes one expected event and is reported separately from a miss; extra notes remain separate. MIDI note-off and zero-velocity note-on releases clear held keys and sound, while computer auto-repeat cannot score repeated notes.

Imported note durations are retained for display and later lessons. Hold length, fingering, dynamics, pedal technique and advanced chord partial-credit rules are not graded in this pilot. Computer-key octave controls affect computer keys; MIDI pitches stay literal, with no silent octave forgiveness. Published keyboard parts can use a wider range than the provided one-octave exercises.

Input controls collapse when playback starts so students can see their music. In a room, the assigned song/part is locked; input settings remain adjustable before a take, and changes clear readiness. Each student can choose a view for drums. Keyboard uses a piano note highway and key guide.

## Timing and networking

The teacher controls one room transport and locks the song revision/parts for the take. Every take has a unique ID. Ready activates browser audio and loads the files needed on that device. The teacher must explicitly enable classroom audio too; a remote Start message cannot substitute for that user interaction.

Repeated round trips estimate the server clock against each client's monotonic clock. A future start is mapped to the local audio clock. Input grading uses local native timestamps and local timing correction, independent of packet arrival. Teacher progress is batched at roughly five updates per student per second. Estimated clock uncertainty is displayed; it is not a measurement of physical audio latency.

Disconnects, hidden student tabs, lost audio and stale/late starts have explicit outcomes. Rejoining a running take waits for a fresh take. The teacher uses Stop / prepare next take, everyone presses Ready again, then a new count-in starts. Live rooms are in memory on one server replica; a restart or deployment ends them. Finished reports and interrupted take states persist. Start with this behavior before adding pause/resume, seeking, shared loop changes or multiple server instances.

No live instrument audio is streamed between computers. The initial room coordinates charts/backing and practice feedback. Headphone backing on each computer and remote live-audio jamming need separate output-latency/network tests.

## Accounts and storage

Reuse the current school login and roster. Room creation/control is limited to the teacher who owns that room. Students see only their own participant state/history. The teacher sees their assigned room's performers and their own recent grouped takes. A student cannot start the room, impersonate another performer, or open another student's results. One scored connection per account/room prevents duplicated tabs from grading twice.

WebSocket upgrades validate the school origin and session; the initial handshake also validates the anti-forgery token. Messages recheck current authentication and room membership, validate payloads and apply size/rate bounds. No password or raw unlimited MIDI stream is sent in the progress feed. These remain browser-reported practice statistics, not tamper-proof examination grades.

Version 0.11 creates a recovery copy before opening an existing school and adds band_takes/band_results without replacing tables or school identity. Versioned arrangements are stored in published song metadata. Existing drum records need no republishing. Keep the same Railway volume/path, one replica and the existing [backup procedure](CLASSROOMS.md). Older app versions refuse schema 2 rather than downgrading it; fix forward or use a deliberate private backup/restore procedure.

## Next work after the classroom trial

Resolve measured hardware/network findings first. Then add keyboard treble-clef/fullscreen notation, chord and held-note lessons, two hands/pedals, more duet material and richer teacher lanes. The part/input/judge boundaries can support MIDI bass/guitar controllers later. Real guitar/bass audio recognition, vocal judging and remote live-audio streaming remain separate projects.

The previous 2–4 developer-week estimate was for two existing drum players. Milestones now describe reviewable results, not promised calendar dates or a fixed number of chat sessions.

Technical references: [Web MIDI guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API), [MIDI carries events rather than audio](https://webaudio.github.io/web-midi-api/), [browser audio activation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [ws server documentation](https://github.com/websockets/ws), [Railway realtime transports](https://docs.railway.com/guides/sse-vs-websockets).
