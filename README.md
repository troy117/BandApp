# Groove Lab

A browser drum-practice prototype for Sierra Charter School. Works without a build step or downloaded dependencies.

Source repository: [troy117/BandApp](https://github.com/troy117/BandApp). Prepared for Railway hosting. Guest imports stay on the device; teacher publishing explicitly uploads songs and sync settings to the shared school library. Optional teacher/student accounts store practice results on the server. See [school accounts and Railway setup](docs/CLASSROOMS.md).

Continuing development on another computer: start with [the handoff and next steps](docs/HANDOFF.md), [discussion and decisions](docs/DISCUSSION_LOG.md), [release changes](CHANGELOG.md), the [conversation record](docs/CONVERSATION.md), and the [shared jam-session plan](docs/JAM_SESSIONS.md).

## Run locally

To generate a standalone copy from a fresh source checkout, run `npm run standalone`. On Windows, double-click **Open Groove Lab.cmd**, or open **artifacts/Groove Lab.html** in Chrome. The standalone copy includes all code, styles, and synthesized audio and needs no server or internet connection. Regenerate it after source changes. Generated files are excluded from Git.

For development:

Use Node.js 24 LTS. There are no runtime dependencies to install.

```sh
npm run dev
```

Open http://localhost:4173 in Chrome on Windows. For Chromebook testing, open the standalone HTML file in Chrome, or serve the `dist` directory from an HTTPS host. No Electron or Linux subsystem is needed. The modular `dist/index.html` needs an HTTP server; the generated standalone copy also works directly from a file.

## Connect a USB drumkit

Choose **Connect drumkit** at the top (or open **Controls**), allow MIDI access in Chrome, then choose **TD-17**. Strike each pad to check the live readout. **Check or change pad assignments → Learn pad** adds or reassigns a pad/rim/edge by striking it. Choose **Done**, then **Start groove**; kit hits share the keyboard scoring clock in every view.

Use the Roland module’s USB COMPUTER port. If it is not detected, **SETUP → USB → USB Driver Mode → GENERIC**, then power the module off/on, provides MIDI without a Roland driver. VENDOR works with Roland’s Windows driver. Generic mode carries MIDI only; backing audio/metronome play from the computer. App drum sounds for kit hits default off so you can use the module’s sounds. Keyboard/on-screen sounds remain available.

Connections require a supported browser (target: Chrome on Windows/ChromeOS) on HTTPS or localhost. Pad mappings and sound preference save in this browser, separately from keyboard controls and song-import mappings. Hardware latency, pad variants and school browser policy still require testing with the real kit. See [the TD-17 setup and troubleshooting guide](docs/DRUMKIT.md).

## Play

- Click **Start groove** or press Enter. Four metronome beats count you in.
- Meet each approaching note in its matching hit box. The center mark is the exact beat. The first exercise uses Kick, Snare, and Hi-hat.
- Use **Note highway / Sheet music / Full sheet** to change views, including during playback. All three views share the same song clock, keyboard controls, scoring, and report.
- Space = kick, F/G = snare, D = hi-hat, J/K/L = toms, A = crash, S = ride.
- **Controls** lets you replace keys or add alternates. Duplicate assignments are rejected. Keys and practice settings save in this browser's local storage. If storage is blocked, changes last for the visit.
- **Listen first** plays an unscored demonstration. **Guide drums** adds demonstration drums to a scored run; the score always requires actual user input.
- Esc stops a run. Complete a run to see timing results or export per-note CSV.
- A hidden tab or unfocused window stops the current run, avoiding misleading scores.
- Tempo (40–160 BPM), length, and timing tolerance are configurable between runs.
- **Tracks** opens 24 original exercises across four levels. Choosing a card sets a suggested starting tempo. The track dropdown also groups them by level.

## Practice sections and progression

Use **Practice your way** below the playback controls:

1. Turn on **Repeat a section**, choose inclusive **From bar / Through bar** numbers, and select **1, 2, 4, or 8 passes**. One count-in leads into continuous repeats, with no extra pause between passes. A section with no mapped hits is rejected.
2. Pick **All drums**, **Kick only**, **Snare only**, **Cymbals only**, or **Toms only**. Only that focus enters the score, guide drums, and notation. Other mapped keys still make sounds and do not add extra-hit penalties in a focused run. An external backing recording retains its original instruments.
3. For built-in tracks, enable **Add 5 BPM each pass** to build speed, capped at 160 BPM. The full plan and tempo range appear before starting. MIDI sections preserve their original tempo/meter changes; tempo building is disabled for them.
4. Start or listen in any view. The display identifies the pass and the original source bar. MIDI backing audio starts at the matching recording position and is bounded to the selected section on every pass, respecting its alignment offset. Stop/Esc cancels all scheduled recording slices.
5. Complete the run for an overall report and a per-pass breakdown. **Try 5 BPM slower** restores the reported exercise and section at a lower starting tempo. **Explore next track** selects the next exercise at its suggested tempo. **Play again** restores that report's setup; an imported song must still be loaded to replay it.

The loop range and focus reset when changing tracks, and are clamped if the built-in track length changes. Setup is remembered for the current track in this browser. View switching stays available during playback; other practice settings lock until the run ends. Runs are limited to 20 minutes and 50,000 expected hits; use a smaller section or fewer passes for large files. Stopping early discards the unfinished run. Complete a selected number of passes to save its results.

The library contains six tracks in each level:

| Level | Practice goals |
| --- | --- |
| 1 · Steady starts | Quarter-note pulse, snare control, hi-hat, backbeat, rock, and four-on-the-floor |
| 2 · Coordination | Eighth-note kick pairs, offbeats, ride, tom locations, snare pairs, and crash entrances |
| 3 · Syncopation | Displaced kicks, sixteenth hats, pickups, short fills, and keeping time through rests |
| 4 · Fills & challenges | Funk patterns, snare combinations, descending tom fills, and two-/four-bar phrases |

All levels remain open. The difficulty reflects coordination and rhythm complexity; harder material starts at a slower suggested tempo where useful. These are original synthesized drum exercises.

**Your practice journal** shows completed scored runs, including tempo range, source bars, passes, focus, timing window, match rate, and average timing error. Guests keep the last 30 summaries in this browser. Signed-in users save summaries and a drum-by-drum timing breakdown to their school account, accessible on other computers. Listen mode and interrupted runs do not add entries. Recent full-kit bests appear on track cards with their tempo and timing window. Historical per-note data and CSVs are not stored; the current report exports per-note CSV with source bar and pass columns.

## Read grooves and imported MIDI

**Sheet music** displays a five-line percussion staff for all 24 built-in exercises, including the toms, crash, and ride. Kick is in the bottom space, snare in the second space from the top, and cymbals use X-shaped noteheads. Simultaneous heads share a stem: play them together. Quarter, eighth, and sixteenth notes and rests are supported. Rests mean silence, including when a drum focus removes other voices. Beams group notes within each beat, with flags for isolated subdivisions. This is a single rhythmic voice. The notation is drawn locally, with no external music font or rendering dependency.

The gold playhead crosses each note on its scheduled beat, and the score scrolls continuously to keep upcoming measures visible. Count along with **1 & 2 &** or **1 e & a 2 e & a** as needed. The playhead follows the tempo changes in speed-building passes. Notes glow when due; in scored practice, matched heads gain a green check and missed heads fade red. The legend shows the current keys and updates after remapping. **UP NEXT / HIT NOW** names the drums due together in any view. Visual cues guide playing; the selected timing window still controls scoring.

**Full sheet** wraps the entire practice score into rows with a gold play bar. The page follows the active row during playback; scroll to review any section. It works for built-ins and imported MIDI, including focused/repeated sections and tempo or meter changes. Choose the corner-shaped **Full screen** icon beside the view controls to maximize any of the three practice views. A compact toolbar keeps **Play/Stop**, **Listen first**, the song title and an exit icon visible. A View selector changes between highway, sheet music and full sheet without leaving fullscreen or resetting playback. Sheet views keep a drum/key legend inside fullscreen. Full-sheet rows use tighter spacing to fit more music. **Esc** exits full screen while playback continues; **Stop** or **Enter** stops the run. Completed scored runs leave full screen to show the report. Only visible rows are drawn, so long scores do not require a huge canvas.

The highway has a colored target box for each active drum or cymbal. Play as the bar's center meets the center mark inside its box. Targets light at the beat and flash when you strike their drum. Switching views keeps the current run and score intact. View preference is saved in this browser. **Imported MIDI also supports Sheet music**, with rests, triplets, 32nd notes, changing meters, partial measures, drum focus, and repeated sections. All three views use the same scoring clock. MIDI note positions are rounded only for readable engraving; their original timing is retained for playback, scoring, and the playhead. This is one combined rhythm voice rather than a publisher's original multivoice score. Lyrics, sticking, accents, ghost-note marks, and Songsterr's page layout are not reconstructed from MIDI.

The staff conventions follow common modern drum notation; see [Drumeo's reading guide](https://www.drumeo.com/beat/how-to-read-drum-music/) for an introduction. Music publishers can use different drum positions, so this app keeps its own legend visible.

## Import MIDI with backing audio

1. Click **Import song**. Use **Try sample MIDI + audio** for an original demonstration with drums, a separate bass part, and a tempo change.
2. Choose a standard `.mid` or `.midi` file. Format 0 and 1 files with musical beat timing are supported. Drum parts on General MIDI channel 10 are suggested automatically; select or deselect parts as needed. Non-drum tracks do not enter the score unless selected.
3. Check each MIDI note's drum assignment. Change it to a different kit piece, or choose **Ignore this note**. These song assignments are separate from the existing keyboard controls. Side sticks/claps default to snare; splash/China cymbals default to crash. Other unsupported percussion is explicitly ignored until mapped.
4. Optionally choose a matching backing recording. MP3 and WAV are recommended; other formats depend on the browser's decoder. Files decode locally, without uploads or an external service. MIDI without backing audio is also playable, with a metronome and synthesized guide drums.
5. Open **Sync audio & MIDI**. **Suggest alignment** compares recording attacks with the selected drum part, searching ±60 seconds around the current offset (or ±12 seconds after a rough match). Optionally search a small duration difference of ±8%. Choose one of up to three candidates; nothing is applied automatically. Use **Preview together · 8 sec** at the beginning and a later MIDI bar. A repeated pattern can match several bars, and vocals or other instruments may create misleading attacks. A suggestion is a starting point, not a verified song match.
6. For manual alignment, use the **colored MIDI hit overlays** on the waveform. Separate drum rows and a legend identify simultaneous strikes. Click a hit in a drum row to select its MIDI bar/beat, then click the same attack in the audio waveform and choose **Apply beat match**. You can also enter a MIDI bar, beat, and recording timestamp directly. Zoom to two seconds for precision and use **Hear recording here**. Gold lines mark aligned MIDI bar starts; the gold cursor marks the chosen recording timestamp. Markers update as offset or MIDI speed changes. Uncheck **Overlay MIDI drum hits** for audio alone. Positive offsets delay the recording; negative offsets skip its intro. Nudge audio 50 ms earlier/later or enter an exact offset.
7. If the start matches but later beats drift, enable **Use a second match**, enter the same later beat in both files, and apply. This fits a single duration ratio and start offset. **MIDI speed** (50–200%) adjusts note/metronome timing; the recording stays at normal speed and pitch. Internal MIDI tempo changes are preserved proportionally. This cannot repair missing verses, a different arrangement, or varying drift throughout a live performance; choose the matching recording or a shorter section.
8. Click **Use this song** and choose either practice view. Backing audio and note playback share the Web Audio clock, and both stop when a run stops or finishes. Preview audio stops when setup closes, the window loses focus, or the tab is hidden. Closing setup also cancels analysis.

Imported songs use their MIDI tempo map, optionally scaled by the song's sync setup; the main tempo and groove-length controls stay disabled. With section practice off, the run ends at the adjusted MIDI song's end, trimming trailing backing audio. A section repeat uses the matching adjusted recording slice on every pass. The count-in is one bar at that section's starting tempo and meter. Velocity affects guide sound volume, but is not graded.

Keyboard controls remain saved. Per-song track selections, note assignments, audio offset, MIDI speed, and volume are remembered for the last ten MIDI files. Choose **Save to library** in Song setup to also keep the MIDI and backing recording after a reload. Without saving, the files last for this visit. Reopening **Song setup** while the app is open retains the selected audio. **Unload song** returns to the built-in exercises. **Download song setup** creates a small JSON file containing mappings and alignment only. On another computer import the exact same MIDI and matching audio, then **Load song setup**. The MIDI fingerprint must match. Music files, keyboard bindings, and practice history are not included in that JSON or in GitHub.

File limits: MIDI up to 10 MB, audio up to 100 MB, songs up to 20 minutes, and up to 50,000 mapped drum hits. Invalid/truncated files, unsupported format-2/SMPTE timing, and offsets that skip the entire recording produce an explanation. Rock Band/Clone Hero difficulty and cymbal-marker encoding is not interpreted in this milestone; use General MIDI files or manually assign only the desired chart notes.

To create the original sample as separate files for testing the file picker, run `npm run samples`. They appear in `artifacts/sample-song/`.

Use wired headphones or speakers. Keyboard hardware may block certain simultaneous key combinations; change keys if a pad does not light. This prototype does not grade dynamics or stick technique.

## Song library

Songs loaded from either library open directly in practice with their saved part selection, mapping and alignment. A **Backing volume** slider sits above the view switch and works during playback. **Edit song setup** opens the detailed settings when needed (teachers/guests). Volume changes affect the loaded song for this visit; saving the device copy or publishing an update retains the chosen volume.

**School library** appears after sign-in. Teachers publish songs for all students, and students practice with the saved drum mapping/backing alignment. Teachers manage their own published songs; the school owner can manage all songs. Students' completed practice results save to their accounts, and teachers see their own students' results in the classroom dashboard. Student usernames do not need email. [Activation and account instructions](docs/CLASSROOMS.md).

**This device** preserves the original browser library described below. Teachers can choose **Publish to school** on an existing device song to upload it; publishing is never automatic. Students use the school library. Guest history and local files are not automatically attached to an account.

Open **Song library** at the top of the page to load a saved song. Loading opens its setup for review; choose **Use this song** to practice. **Update saved song** replaces that saved entry with the current audio, mappings, and alignment. Importing a new file and saving creates a new entry, even if it has the same name. **Archive** hides an entry; **Show archived songs → Restore** brings it back. Archiving retains the files and does not free storage space.

The **device library** uses IndexedDB on the current website address, browser profile, and device. It does not sync between computers, localhost and Railway, or different domains. The **school library** uses persistent server storage and is available from any computer signed in at the same school website. Keep original MIDI and audio files as your backup. Browser cleanup, storage eviction, and private browsing can remove device songs. If browser storage is unavailable or full, import and playback still work for the visit. File URLs may have restricted storage; use localhost or the hosted HTTPS app for the library.

## Host on Railway

1. In Railway, create a service from the **troy117/BandApp** GitHub repository and select **main**.
2. Leave the root directory at the repository root. The app files and package.json are at that root.
3. Use Railway's Node/Railpack detection. No build command is needed. Set the start command to **npm start** if it is not detected automatically.
4. Set the healthcheck path to **/healthz**, then generate a public domain in the service's networking settings.
5. Open the HTTPS domain in Chrome on Windows or Chromebook. Import files there and choose Save to library to start that browser's library.

The production server listens on **0.0.0.0** and Railway's **PORT**. Guest practice works without a database. **School accounts require a persistent volume and hosting variables**; follow [CLASSROOMS.md](docs/CLASSROOMS.md) before creating real accounts. Node 24's built-in SQLite handles the school database, with music files on the same volume; no runtime package installation is needed. The development command binds to localhost and uses ignored `.groove-data/` storage. Production startup can be checked locally with `npm start`; stop a development server using port 4173 first, or set a different PORT. The static app is already in `dist`; generated exports and school data are excluded from Git.

See the official [start command](https://docs.railway.com/deployments/start-command), [listening address](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond), and [healthcheck](https://docs.railway.com/deployments/healthchecks) documentation.

## Timing

Web Audio schedules the click and guide notes with a short lookahead. The keyboard adapter forwards native event timestamps. When supported, `AudioContext.getOutputTimestamp()` relates the audible audio clock to event timestamps; the fallback estimates output delay. The renderer does not supply the input time used for grading. Browser/hardware timing precision has not been measured against the school equipment.

A positive manual input correction subtracts milliseconds from measured hit times. It defaults to zero and is not an automatic calibration procedure. A hit can consume at most one pending note of the same drum. Missing notes and extra strikes are tracked independently. Report match rate is `hits / (expected notes + extras)`. Negative timing error is early, positive is late; average absolute error avoids cancellation.

## Verify

```sh
npm test
npm run check
```

Tests cover exercise timing, simultaneous voices, one-to-one matching, repeat hits, early/late errors, window boundaries, extra/missed hits, CSV, keyboard mappings, MIDI parsing and track selection, running status, malformed input, tempo and meter changes, custom drum assignments, audio offsets, backing-source scheduling/stop, the matching sample WAV, production HTTP serving/path restrictions, notation onset/duration fidelity at all exercise tempos and lengths, live scoring references, playhead/scroll alignment, grouped hit cues, selected-bar boundaries, tempo-building timelines, per-pass scores, bounded history, recording-slice scheduling/cancellation, onset analysis, cancellation/rejection, alignment math, MIDI speed scaling, and imported rhythms/meters. Browser checks cover saving MIDI/audio/setup, reload and playback, archive/restore, all three practice views, changing view during a scored run, key legends, saved preferences, imported-song notation and live view switching, count-in/listen behavior, focused loops, tempo changes, restored practice setup, per-pass reports, difficulty browsing, and saved history.

## Current scope and next steps

Included: built-in drum sheet music with a scrolling playhead and live view toggle, highway hit boxes and grouped hit cues, a browser song library with saved MIDI/audio/setup and archive/restore, a Railway-ready static server, 24 original grooves in four levels, continuous section repeats with matching MIDI backing slices, drum focus, per-pass tempo building, local practice history, standard MIDI import, drum-part selection and note mapping, local backing audio with start alignment and volume, an original sample MIDI/WAV pair, synthesized drum sounds, configurable keyboard controls, listen mode, count-in, timing windows, reports, and CSV export. No external fonts, CDNs, analytics, or downloaded runtime packages are required. The MIT-licensed MIDI parser is bundled locally.

Version 0.10 adds fullscreen in every practice view, school storage/mount/identity checks and private database recovery copies before version updates. Use the same Railway volume across deployments and enable independent backups; GitHub does not hold school data. See [storage and recovery](docs/CLASSROOMS.md#preserve-data-through-every-update). The [jam-session roadmap](docs/JAM_SESSIONS.md) describes a teacher-led two-drummer pilot; shared sessions are not implemented yet.

Version 0.8 adds the full-sheet view, direct library loading, live backing-volume controls and a smaller page header. Version 0.7 adds teacher/student accounts, a shared school song library and saved account progress. Classroom features require the [persistent Railway storage setup](docs/CLASSROOMS.md). Version 0.6 added local audio alignment suggestions, waveform previews, one/two-point manual alignment, portable song setups, and sheet music for imported MIDI. Version 0.9 adds USB MIDI drumkit input, a device picker, live pad feedback, pad learning and reconnection. Next: verify the real TD-17 pads/latency and the current school’s backup/redeploy behavior, then build the teacher-led jam pilot. See [the milestone plan](docs/HANDOFF.md). This version does not yet install as a PWA or warp changing drift. Cymbal chokes, continuous hi-hat openness and hit strength are not graded.

See THIRD_PARTY_NOTICES.md for the SightKick reuse assessment and license.
