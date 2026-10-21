# First drum and keyboard classroom test

Prototype 11 · October 21, 2026

## Before the lesson

Confirm the hosted footer says Prototype 11. Keep the existing Railway service, volume and GROOVE_DATA_DIR. This update adds tables to the existing database; it does not need a new school, a new volume or new server variables. Railway must install the locked ws dependency; keep Node 24, npm start and one replica. Enable/check backups separately as described in [CLASSROOMS.md](CLASSROOMS.md).

Use three computers: the teacher's computer with a classroom speaker, a student computer connected to the TD-17, and a student computer connected to the MIDI keyboard. Start in Chrome on Windows; Chromebook behavior also needs a real test. All computers open the same HTTPS school website. Each student uses a different teacher-created account and must have chosen their own password before being assigned to a session. Ordinary browser tabs share a login; use separate computers for the classroom trial.

## Check the keyboard by itself

1. Choose Keyboard, then Together on one. Select Keyboard as your part.
2. Open Input and sound settings and choose Connect MIDI keyboard. Allow Chrome's MIDI permission and choose the actual keyboard input if more than one device appears. Play a few keys: the live readout should show note name, MIDI number, channel and strength, and the on-screen key should light when in range. C4 is MIDI note 60; physical keyboard octave labels may differ.
3. Enable app instrument sounds if using a silent MIDI controller. If your keyboard already produces sound through its own speaker/amplifier, turn app sounds off to avoid doubling it. Press Play part or Listen first to enable browser audio.
4. Play the one-hand melody. The first pilot scores correct pitch and onset timing. After completion, inspect matched, wrong, missed and extra notes plus early/late feedback. Download the note timing CSV for details.
5. For computer-key testing, defaults are A/S/D/F/G/H/J/K for C4/D4/E4/F4/G4/A4/B4/C5; W/E/T/Y/U are black keys. Change computer keys lets you rebind notes and choose the computer-key octave. These settings save locally, separately from drum controls. MIDI pitches are not automatically transposed.

## Check the drums

Use the existing Drums area and Connect drumkit controls to select the TD-17 and check pad/rim/edge mappings. See [DRUMKIT.md](DRUMKIT.md). Confirm keyboard testing still works. In a session drum part, Connect / map drumkit opens those same controls; the saved pad mapping is reused. Kit sound follows the drum control setting; the computer-key sound switch controls the test keys.

## Start the first duet

1. On the teacher computer, sign in and choose Jam session. Select Together on one, choose two different students and assign Drums to one and Keyboard to the other. Choose Create session.
2. On each student computer, sign in and choose Jam session. Refresh sessions if needed, then select the teacher's invitation. The assigned part loads automatically. The student may choose their local MIDI input or computer keys before pressing Ready.
3. Each student presses Check sound & Ready. The app measures timing, enables local audio and brings the music into view. Keep both student tabs visible. The drummer may choose highway, sheet or full sheet; the keyboard uses the piano note highway. Fullscreen includes a play/stop control for solo practice; in a room the teacher controls playback.
4. The teacher presses Enable classroom speaker & Ready. When both students are ready, Start together becomes available. Press it once for the shared four-beat count-in. Start with the teacher as the only backing source; provided duets use synthesized backing. Both students hear their own instruments locally.
5. Watch separate performer cards on the teacher screen. Verify both timelines follow the same song position and that each student's notes affect only their own report. Complete the take and inspect both results. The students can inspect their own school histories; the teacher can refresh Recent shared takes for the grouped reports.
6. Choose Prepare next take. Both students and the teacher press Ready again before the next count-in. Try the slower/simple duet first, then Step by step and the longer Stay together exercise.

## Check recovery and persistence

After one successful take, try unplugging the keyboard or kit and hiding one student tab. The affected take should show an interruption rather than a completed score. Reconnect, choose the correct input, and have the teacher prepare a fresh take. A student who reconnects during playback waits for the next take. If another tab already holds that account's seat, leave it or wait for its connection to close before rejoining.

Refresh a completed student's page and inspect the saved report. Check the teacher's Recent shared takes. Verify the existing school songs/accounts are still present after the hosted update and a later normal redeploy. A server restart/deployment ends active rooms; it retains completed results and labels unfinished takes interrupted. The teacher creates a fresh room after a restart. Do not recreate the school or volume to recover a room.

## Use your own MIDI and backing

In Keyboard, choose Prepare MIDI duet, select the MIDI and explicitly assign its tracks/channels to drums or keyboard. Ignore other tracks. A file containing only drums can still be used for drums; it needs an actual keyboard part for a mixed duet.

Add optional backing audio and the shared offset/MIDI speed/volume. The existing drum Song setup waveform can help determine alignment; use those same offset/speed values here. Use arrangement locally previews the parts. A teacher chooses Publish new school song to store the MIDI, audio and both part settings for other computers. Published songs appear in the practice-song selector and teacher session selector. Unpublished local arrangements last for the visit; their reports can be downloaded, while provided/published songs support account saving. Download arrangement setup saves a small JSON, to be loaded with the same MIDI and backing files later.

## What to record from the hardware trial

- Computer/browser, keyboard model and TD-17 input/mapping behavior.
- Whether the count-in, moving notes and teacher backing sound feel aligned at both student positions; check a longer exercise for drift.
- Any consistent early/late tendency per computer/input, and the chosen Timing correction value. Keep the song's backing alignment shared; per-device timing correction changes grading, not the recording arrangement.
- Duplicate sounds, missing permissions, disconnect messages, and whether reports persist after refresh/redeploy.

Clock uncertainty is a software estimate, not proof of physical audio latency. The hardware trial is the remaining milestone; keyboard staff notation, chords, hold/pedal grading and additional instruments follow it.
