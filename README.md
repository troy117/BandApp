# Groove Lab

A browser drum-practice prototype for Sierra Charter School. Works without a build step or downloaded dependencies.

Source repository: [troy117/BandApp](https://github.com/troy117/BandApp). Prepared for Railway hosting. Imported MIDI and audio stay in the browser; the server only serves the app. No accounts or server database are required.

## Run locally

To generate a standalone copy from a fresh source checkout, run `npm run standalone`. On Windows, double-click **Open Groove Lab.cmd**, or open **artifacts/Groove Lab.html** in Chrome. The standalone copy includes all code, styles, and synthesized audio and needs no server or internet connection. Regenerate it after source changes. Generated files are excluded from Git.

For development:

Use Node.js 24 LTS. There are no runtime dependencies to install.

```sh
npm run dev
```

Open http://localhost:4173 in Chrome on Windows. For Chromebook testing, open the standalone HTML file in Chrome, or serve the `dist` directory from an HTTPS host. No Electron or Linux subsystem is needed. The modular `dist/index.html` needs an HTTP server; the generated standalone copy also works directly from a file.

## Play

- Click **Start groove** or press Enter. Four metronome beats count you in.
- Meet each approaching note in its matching hit box. The center mark is the exact beat. The first exercise uses Kick, Snare, and Hi-hat.
- Use **Sheet music / Note highway** to change views, including during playback. Both views share the same song clock, keyboard controls, scoring, and report.
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
4. Start or listen in either view. The display identifies the pass and the original source bar. MIDI backing audio starts at the matching recording position and is bounded to the selected section on every pass, respecting its alignment offset. Stop/Esc cancels all scheduled recording slices.
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

**Your practice journal** saves summary results for the last 30 completed scored runs in this browser, including tempo range, source bars, passes, focus, timing window, match rate, and average timing error. Listen mode and interrupted runs do not add entries. Recent full-kit bests appear on track cards with their tempo and timing window. These summaries are browser-local and can be lost when browser data is cleared; historical per-note data and CSVs are not stored. The current report still exports per-note CSV, now including source bar and pass columns.

## Read the built-in grooves

**Sheet music** displays a five-line percussion staff for all 24 built-in exercises, including the toms, crash, and ride. Kick is in the bottom space, snare in the second space from the top, and cymbals use X-shaped noteheads. Simultaneous heads share a stem: play them together. Quarter, eighth, and sixteenth notes and rests are supported. Rests mean silence, including when a drum focus removes other voices. Beams group notes within each beat, with flags for isolated subdivisions. This is a single rhythmic voice. The notation is drawn locally, with no external music font or rendering dependency.

The gold playhead crosses each note on its scheduled beat, and the score scrolls continuously to keep upcoming measures visible. Count along with **1 & 2 &** or **1 e & a 2 e & a** as needed. The playhead follows the tempo changes in speed-building passes. Notes glow when due; in scored practice, matched heads gain a green check and missed heads fade red. The legend shows the current keys and updates after remapping. **UP NEXT / HIT NOW** names the drums due together in either view. Visual cues guide playing; the selected timing window still controls scoring.

The highway has a colored target box for each active drum or cymbal. Play as the bar's center meets the center mark inside its box. Targets light at the beat and flash when you strike their drum. Switching views keeps the current run and score intact. View preference is saved in this browser. Imported MIDI continues to use the highway with all its original features; sheet notation for imports is a later milestone. Loading an import temporarily falls back to the highway, and unloading it restores the preferred view.

The staff conventions follow common modern drum notation; see [Drumeo's reading guide](https://www.drumeo.com/beat/how-to-read-drum-music/) for an introduction. Music publishers can use different drum positions, so this app keeps its own legend visible.

## Import MIDI with backing audio

1. Click **Import song**. Use **Try sample MIDI + audio** for an original demonstration with drums, a separate bass part, and a tempo change.
2. Choose a standard `.mid` or `.midi` file. Format 0 and 1 files with musical beat timing are supported. Drum parts on General MIDI channel 10 are suggested automatically; select or deselect parts as needed. Non-drum tracks do not enter the score unless selected.
3. Check each MIDI note's drum assignment. Change it to a different kit piece, or choose **Ignore this note**. These song assignments are separate from the existing keyboard controls. Side sticks/claps default to snare; splash/China cymbals default to crash. Other unsupported percussion is explicitly ignored until mapped.
4. Optionally choose a matching backing recording. MP3 and WAV are recommended; other formats depend on the browser's decoder. Files decode locally, without uploads or an external service. MIDI without backing audio is also playable, with a metronome and synthesized guide drums.
5. Start with an audio offset of 0. **Positive** values delay the recording. **Negative** values skip its intro: −2 skips the first two seconds. Use **Listen first**, then reopen **Song setup** to adjust. The backing recording must follow the same arrangement and tempo as the MIDI. An offset changes the starting alignment; it does not correct tempo differences or drift between different recordings.
6. Click **Use this song** and play with the same keyboard controls. The highway shows every used drum, including toms and cymbals. The imported MIDI's tempo and meter changes drive the notes and metronome. Backing audio and note playback share the Web Audio clock, and both stop when a run stops or finishes.

Imported songs play at their original tempo; tempo and groove-length controls are disabled for them. With section practice off, the run ends at the MIDI song's end, trimming trailing backing audio. With a section selected, each pass uses that section's original timing and recording slice. The count-in is one bar at the selected section's starting tempo and meter. Velocity affects guide sound volume, but is not graded.

Keyboard controls remain saved. Per-song track selections, note assignments, audio offset, and volume are remembered for the last ten MIDI files. Choose **Save to library** in Song setup to also keep the MIDI and backing recording after a reload. Without saving, the files last for this visit. Reopening **Song setup** while the app is open retains the selected audio. **Unload song** returns to the built-in exercises.

File limits: MIDI up to 10 MB, audio up to 100 MB, songs up to 20 minutes, and up to 50,000 mapped drum hits. Invalid/truncated files, unsupported format-2/SMPTE timing, and offsets that skip the entire recording produce an explanation. Rock Band/Clone Hero difficulty and cymbal-marker encoding is not interpreted in this milestone; use General MIDI files or manually assign only the desired chart notes.

To create the original sample as separate files for testing the file picker, run `npm run samples`. They appear in `artifacts/sample-song/`.

Use wired headphones or speakers. Keyboard hardware may block certain simultaneous key combinations; change keys if a pad does not light. This prototype does not grade dynamics or stick technique.

## Song library

Open **Song library** at the top of the page to load a saved song. Loading opens its setup for review; choose **Use this song** to practice. **Update saved song** replaces that saved entry with the current audio, mappings, and alignment. Importing a new file and saving creates a new entry, even if it has the same name. **Archive** hides an entry; **Show archived songs → Restore** brings it back. Archiving retains the files and does not free storage space.

The library uses IndexedDB on the current website address, browser profile, and device. It does not sync between computers, localhost and Railway, or different domains. Keep original MIDI and audio files as your backup. Browser cleanup, storage eviction, and private browsing can remove saved songs. If storage is unavailable or full, import and playback still work for the visit. File URLs may have restricted storage; use localhost or the hosted HTTPS app for the library.

## Host on Railway

1. In Railway, create a service from the **troy117/BandApp** GitHub repository and select **main**.
2. Leave the root directory at the repository root. The app files and package.json are at that root.
3. Use Railway's Node/Railpack detection. No build command is needed. Set the start command to **npm start** if it is not detected automatically.
4. Set the healthcheck path to **/healthz**, then generate a public domain in the service's networking settings.
5. Open the HTTPS domain in Chrome on Windows or Chromebook. Import files there and choose Save to library to start that browser's library.

The production server listens on **0.0.0.0** and Railway's **PORT**. No environment secrets, upload directory, database, or persistent Railway volume are needed. The development command binds only to localhost. Production startup can be checked locally with `npm start`; stop a development server using port 4173 first, or set a different PORT. The static app is already in `dist`, so no generated artifact needs to be committed. Railway serves the modular web app; the optional standalone HTML remains a local convenience.

See the official [start command](https://docs.railway.com/deployments/start-command), [listening address](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond), and [healthcheck](https://docs.railway.com/deployments/healthchecks) documentation.

## Timing

Web Audio schedules the click and guide notes with a short lookahead. The keyboard adapter forwards native event timestamps. When supported, `AudioContext.getOutputTimestamp()` relates the audible audio clock to event timestamps; the fallback estimates output delay. The renderer does not supply the input time used for grading. Browser/hardware timing precision has not been measured against the school equipment.

A positive manual input correction subtracts milliseconds from measured hit times. It defaults to zero and is not an automatic calibration procedure. A hit can consume at most one pending note of the same drum. Missing notes and extra strikes are tracked independently. Report match rate is `hits / (expected notes + extras)`. Negative timing error is early, positive is late; average absolute error avoids cancellation.

## Verify

```sh
npm test
npm run check
```

Tests cover exercise timing, simultaneous voices, one-to-one matching, repeat hits, early/late errors, window boundaries, extra/missed hits, CSV, keyboard mappings, MIDI parsing and track selection, running status, malformed input, tempo and meter changes, custom drum assignments, audio offsets, backing-source scheduling/stop, the matching sample WAV, production HTTP serving/path restrictions, notation onset/duration fidelity at all exercise tempos and lengths, live scoring references, playhead/scroll alignment, grouped hit cues, selected-bar boundaries, tempo-building timelines, per-pass scores, bounded history, and recording-slice scheduling/cancellation. Browser checks cover saving MIDI/audio/setup, reload and playback, archive/restore, both practice views, changing view during a scored run, key legends, saved preferences, imported-song fallback, count-in/listen behavior, focused loops, tempo changes, restored practice setup, per-pass reports, difficulty browsing, and saved history.

## Current scope and next steps

Included: built-in drum sheet music with a scrolling playhead and live view toggle, highway hit boxes and grouped hit cues, a browser song library with saved MIDI/audio/setup and archive/restore, a Railway-ready static server, 24 original grooves in four levels, continuous section repeats with matching MIDI backing slices, drum focus, per-pass tempo building, local practice history, standard MIDI import, drum-part selection and note mapping, local backing audio with start alignment and volume, an original sample MIDI/WAV pair, synthesized drum sounds, configurable keyboard controls, listen mode, count-in, timing windows, reports, and CSV export. No external fonts, CDNs, analytics, or downloaded runtime packages are required. The MIT-licensed MIDI parser is bundled locally.

Next: validate Web MIDI and pad learning with the school's Roland TD-17 when the kit is available. Extend notation to imported MIDI with explicit rhythm quantization. This version does not yet connect MIDI hardware, install as a PWA, change imported-song playback speed, or sync progress between devices.

See THIRD_PARTY_NOTICES.md for the SightKick reuse assessment and license.
