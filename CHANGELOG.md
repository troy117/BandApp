# Changes

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
