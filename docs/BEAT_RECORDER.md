# Record a beat over an audio file

Prototype 30 / 0.30.0, November 4, 2026.

## Student workflow

1. Choose **Drums → Record a beat**. Open a WAV file. MP3, M4A and Ogg can also work when the browser can decode them; failures leave the previous audio and take intact.
2. Set **Audio repeats** (1–16). The whole file repeats at its original speed. The optional four-beat count-in has its own tempo; it does not estimate or change the song tempo. Silence at the beginning/end of the file remains part of each repeat.
3. Open **Kit & keyboard controls** to connect/check the kit if needed. Existing pad assignments, keyboard keys and manual input delay correction apply. Press **Record beat**, wait for the count-in and play. Each pass is captured separately in one continuous take, so the student can change the beat between passes.
4. Recording ends after the chosen repeats. **Stop** keeps a partial take when it contains hits. Count-in hits are ignored. A new empty/cancelled recording retains the previous take; a new nonempty recording replaces the current take. Save a take before recording another to keep both.
5. **Play audio + beat** replays the WAV with the recorded drum part. The timeline marks the drum voices, repeat boundaries and current playback position. Play along on the kit/keys/pads without modifying the take. Separate volume controls let the student lower or mute the recorded beat to practice independently. Stop ends playback; Play always starts at the beginning.
6. Name the take and choose **Save on this device** to retain it. **Saved beats on this device → Open** restores the audio and beat after a reload. Saving the same take again updates it rather than creating a duplicate. Delete removes the saved copy after confirmation; an already open copy stays available for the visit.

This records **hit events** (drum voice, time and velocity), not microphone audio, the module's samples, pedal-motion curves or cymbal choke gestures. Replay uses Groove Lab's synthesized drums. Closed/open/pedal hi-hat remain distinct. There is no quantization, automatic transcription, tempo estimation, grading or student progress report.

## Storage and limits

- Unsaved work lives in memory for the visit. Closing/reopening the recorder keeps it, but reloading, leaving the page, changing accounts or choosing different audio clears unsaved work. A browser Back/Forward event closes/stops the recorder; navigating away can discard the page.
- Saving is explicit, never automatic. The original audio bytes and hit events are stored in the browser's separate `groove-lab-beats` IndexedDB database. No files, recordings or student results are uploaded. Saves are shared by users of this browser/origin, not owned by the signed-in student, and the UI states this. Clearing browser data or browser eviction can remove them; this is not a backup or cross-device sync service.
- File limit: 60 MiB; decoded length: 0.1 seconds–10 minutes; take: up to 16 repeats / 20 minutes / 50,000 hits. Failed decoding, validation or storage leaves the usable current take in memory. No server database migration or production storage access is involved.
- MIDI permission uses the existing opt-in Controls flow. The recorder never requests a microphone. Audio starts from an explicit Record/Play/pad action. If audio activation is rejected, controls recover and explain the failure.

## Transport and integration

`beat-recorder.mjs` owns a dedicated `DrumAudio`, a cancellable activation token and a short scheduling timer. All backing passes are scheduled at exact offsets on one AudioContext clock. Input timestamps use `audibleTime`, with the same sign and snapshot of input delay correction used in normal drum practice. Replayed hits use their original times and velocities; live input never appends to an existing take during replay. A late scheduling callback skips obsolete notes instead of producing a burst.

Stop, close/Escape, tab hiding, window blur, navigation, audio suspension and kit loss cancel sources and timers; a partial recording retains reached hits. Pending audio activation/decoding cannot reopen or start after cancellation. Controls pause recording and retain the partial take; their input-learning flow stays separate. Switching instrument or school identity stops the recorder. Opening the recorder stops solo practice; it refuses to open/start in a shared jam without changing the room. The original drum report/Retry and other instrument transports retain their own state and persistence.

`beat-recorder-view.mjs` provides a responsive native dialog with keyboard controls, native button activation, labeled inputs, status announcements, on-screen pads and a cached timeline. `beat-library.mjs` saves/retrieves/deletes both metadata and audio in an atomic device-local transaction. Standalone export includes all three modules. There are no new dependencies, network APIs, account permissions, Railway variables or volume changes.

## Verification

Release checks: all **263 tests** passed, as did `npm run check`, `npm run standalone`, the recorder Chromium suite and the existing drum report/Retry Chromium suite (including teacher access, report persistence and other instrument transitions). Browser evidence contains no page errors. The optional generated-file runtime check at `file:///workspace/BandApp/artifacts/Groove%20Lab.html` was blocked by managed Chromium with `ERR_BLOCKED_BY_ADMINISTRATOR`; it was not bypassed. Export generation/syntax and the normal HTTP app were verified.

Automated transport tests cover exact repeat boundaries, count-in exclusion, timestamp/velocity preservation, separate hi-hats, partial replay, delay correction, out-of-order input, live practice without overdubbing, repeated starts/stops, cancellation during pending activation, rejected audio, suspended audio, invalid/release input, muted/late replay and input/storage validation bounds. Existing MIDI tests cover note-offs, velocity-zero Note On, CC4 and custom mappings.

Browser QA uses an original two-second synthetic WAV, synthetic MIDI notes and real browser keyboard events, served by an isolated local server without school accounts or production requests. Evidence and the reproducible harness live under ignored `artifacts/beat-recorder-qa/`. Checks include full record→replay→save→reload→open→replay, exact backing/take preservation, all three hi-hat voices, count-in, partial stops, controls, rejection/failure recovery, repeated saves, Escape, Back/Forward, jam guard, responsive layouts and returning to normal drum/keyboard practice. The earlier isolated report/Retry browser suite remains applicable.

## Physical TD-17 check

Cloud checks do not verify a physical TD-17, USB driver, speaker/headphone path or human-perceived latency. In Windows Chrome with the usual kit connected:

1. Open Controls, choose the TD-17 input and check kick/snare plus closed/open bow/edge and pedal. Preserve the kit's learned/custom mapping. If listening to module sounds while recording, leave the existing browser drum-sound toggle off to avoid doubled live drums.
2. Load a short WAV with a clear beat. Use wired audio, set two repeats and match the count-in tempo by ear. Play both sides of the repeat boundary; check the complete take includes both passes and differing hi-hats.
3. Replay through the same output route. Listen for the beat relative to the WAV at the beginning, repeat boundary and end. If a consistent device delay is present, check the existing input delay correction before recording a fresh take. The app does not measure or remove arbitrary USB/Bluetooth/output latency automatically.
4. Stop midway, replay, save, reload and reopen. Unplug the kit during a test recording and verify it stops with the captured part retained; reconnect in Controls and start a fresh take. Check the school's browser allows MIDI and device storage. No production student result should be created by this workflow.
