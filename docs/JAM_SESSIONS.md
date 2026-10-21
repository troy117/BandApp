# Shared jam sessions: development plan

October 20, 2026. This is the next proposed milestone, not a feature implemented in Prototype 10.

## Intended experience

A teacher opens a jam room, selects a school song and invites two students playing drums. Each student signs in on their own computer, chooses their notation/highway view and input device, loads the assigned music and presses Ready. The teacher sees both students ready and starts one shared count-in. Each student plays their part; the teacher sees separate live progress, hits/misses, streak and early/late tendency. Results remain attached to each student's account.

Later, the teacher's display can combine drum, bass, guitar and vocal parts into a Rock Band-style band overview, while each performer sees their own music. Two students can play the same instrument; parts must not be keyed only by instrument name.

## Feasibility and initial boundary

This is feasible with the current browser app. Reuse school identities/rosters, immutable published song versions, keyboard and USB MIDI input, the timing judge, backing alignment, reports and all three fullscreen practice views. Add a room/transport layer around individual practice, with ordinary solo practice remaining available.

The first pilot should use **one teacher and two drummers in the same classroom, on separate computers**, one published song/version and a shared tempo/section. Each participant chooses their own visual view. Start with the same drum part; separate part assignments can follow once synchronization works. Keyboard-only testing remains supported.

This pilot coordinates playback and progress. Streaming everyone's live instrument audio over the internet is a separate low-latency audio project. For a room full of instruments, start with one audible backing source on the teacher's computer to avoid several speakers producing echoes. Test an optional headphones/backing-on-each-device mode separately. Neither arrangement eliminates the need to measure output latency on the actual classroom equipment.

## Milestones and estimated effort

These are rough engineering estimates for an experienced developer working on this repository, including useful tests and classroom trials. They are not delivery commitments; real network/audio behavior and feedback can change them.

| Milestone | Reviewable result | Rough focused development time |
| --- | --- | --- |
| 0. Keep school data safe | Verify current volume and school identity, scheduled backups and a private off-volume backup; test a restore using synthetic accounts | Required foundation; safeguards added in 0.10, hosted backup configuration still needs checking |
| 1. Teacher room and student readiness | Teacher creates a room; signed-in students join; correct song/version loads; teacher sees input/audio readiness | 2–3 days |
| 2. Shared start and timing | Ready gesture unlocks browser audio; files preload; clocks are measured; teacher schedules a future start/count-in; both student views follow the song | 4–6 days |
| 3. Teacher band overview | Two separate progress cards/lanes, hit/miss feedback, connection state, stop/restart and per-student results | 2–4 days |
| 4. Classroom pilot and recovery | Reconnects, late loading, hidden tabs, duplicate joins, permissions, network jitter and real two-kit tests | 3–5 days |

A useful two-drummer pilot is approximately **2–4 developer weeks**. A broader classroom release with repeated device/network testing and polish is more reasonably **4–8 weeks total**. Work can be reviewed one milestone at a time. These estimates exclude new guitar/bass/vocal audio recognition.

## Timing and networking design

- Use one authoritative teacher-controlled room transport. Lock song version, tempo, alignment and section settings for the take. Reject incompatible versions instead of starting different music.
- Every student must explicitly press Ready so their browser can start audio and complete decoding before the teacher starts. Loading progress and blocked audio need visible states.
- Synchronize each client's monotonic clock to the server with repeated round-trip measurements; map the agreed future start to the local Web Audio clock. Allow a short lead time for the count-in and reject a start if a participant isn't ready.
- Grade keyboard/MIDI strikes locally with their native timestamps, as now. Network arrival time must never determine early/late grades. The teacher's overview can receive batched feedback roughly 4–10 times per second; it is a monitoring display, not the timing authority for individual hits.
- Measure drift and output/input latency on actual Windows/Chromebook devices. Show synchronization quality honestly, with no promise of sample-accurate playback over ordinary school Wi-Fi. Do not jump the audible song or grading clock mid-note to hide drift.
- A small authenticated WebSocket endpoint is appropriate for shared state and bidirectional updates. Railway supports WebSockets. Choose a maintained server implementation when building this milestone rather than writing a WebSocket protocol parser. Keep the first release on one server instance; rooms may live in memory, with a server restart cleanly aborting the take. Persist finished results, not an endlessly growing raw-hit stream.
- Rejoining a running take should initially mean observing/waiting for the next take. Add graded late joins only after a clear policy and tests. A disconnect must be visible to the teacher, and stopped/interrupted takes must not be saved as completed songs.

Technical references: [Railway realtime transports](https://docs.railway.com/guides/sse-vs-websockets), [browser audio activation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [mapping performance and audio-output timestamps](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp).

## Roles and data model

Suggested additions: a `jamRoom` owned by a teacher, `participants` keyed by student account and connection, `assignments` keyed by participant/part, a versioned `transport` with a take ID and scheduled start, and `jamTake`/participant results linking to the existing student run IDs. Instrument and part must be explicit so two drummers work today and mixed instruments can work later.

Require authentication and room membership on every message. The teacher controls their own room/roster. Students see their own assigned part and score; the supervising teacher sees the room's participants. An invite code must not grant access to other students' private account history. Validate payloads, cap rates and room size, handle expired sessions and reject stale take IDs. Results need idempotent saving across reconnects. Existing browser-reported statistics remain practice feedback rather than tamper-proof exam grades.

## Expanding instruments

First separate the generic song timeline, instrument chart and grading/input adapters from drum-only lane names. Define clear expected notes/articulations and result types for each instrument. Retain the drum judge as its first adapter.

MIDI bass/guitar controllers or keyboard test inputs are a manageable next adapter because they already provide discrete pitches. Judging real electric guitar/bass audio requires an audio interface, permissions, tuning/latency calibration and onset/pitch recognition; polyphonic guitar, bends and noisy signals add significant work. Vocals require microphone input, pitch/rhythm tracking and decisions about which aspects are graded. Treat these as separate researched milestones with real recordings/equipment, not a small switch in the drum input mapper.

## Acceptance checks for the pilot

- Teacher plus two signed-in student browsers can prepare and start the same song; both students retain independent scores and view choices.
- Delayed network messages do not change locally recorded hit errors. Tests exercise clock offset, varying delay, stale starts, repeated transport commands and drift.
- A student cannot control the teacher transport, view another student's history or impersonate a different room participant.
- Disconnect, tab hiding, slow audio loading, permission denial, teacher restart and server restart have visible outcomes and do not fabricate completed scores.
- Classroom testing measures actual start skew and drift with two kits/computers, one backing source and optional individual headphones. Record measured tolerances before calling synchronization reliable.
- A normal deployment preserves the same school identity, accounts, songs and results. A wrong/empty volume pauses school writes instead of creating a replacement school.
