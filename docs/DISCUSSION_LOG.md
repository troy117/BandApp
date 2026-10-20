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
