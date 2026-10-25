# Automatic headphone timing — Prototype 27

Pause the song and leave any teacher-led jam. Tap **Check timing** beside the vocal microphone, keep headphones connected and awake, and hold an earpiece near the microphone the phone is using. In a quiet place at a comfortable volume, tap **Start automatic check** and allow the microphone if asked. Stay quiet through five short chirps (about seven seconds), then put the earpiece back on. A successful check applies the measured timing and resets Extra microphone delay to zero. There is no singing, tapping in time, or manual number to choose.

The microphone has to hear the emitted sound. With a headset microphone, place the earpiece near that mic. Ear detection, echo cancellation, noise suppression, a distant earpiece or noisy room can prevent a useful measurement. A failed or cancelled check keeps the previous timing. It never substitutes a guess and labels it calibrated. Some phone/headset combinations may not permit this acoustic check; the browser estimate and optional manual correction remain available.

Identifiable input/output profiles save only on this browser/device for up to seven days, with a maximum of eight recent profiles. **Clear saved check** removes the current profile. When the browser cannot reliably identify the headphone output, the result is retained for the current visit only. Reported device changes clear the active check; run it again after reconnecting or changing headphones, even if the browser did not report a change. Calibration corrects alignment; it cannot remove the headset’s physical transport delay.

## What is measured

The output clock already compensates the delay the browser reports for playback. The check generates tapered 60 ms frequency sweeps in alternating directions, using the same output path as the backing. A temporary analyser reads the existing opted-in microphone stream. Bounded, downsampled quadrature correlation matches the known chirp and locates its start within the buffer; sample position supplies timing finer than the display update interval. The start’s arrival timestamp is translated through the audible output clock and compared with the scheduled chirp time. The resulting **effective compensation** includes the remaining input/routing delay, not a laboratory measurement of the microphone hardware alone. The analyser half-window remains separate and is not counted twice.

At least four of five matches must be clear, within a 60 ms span with median deviation at most 15 ms, and between 0–1000 ms. Signals with weak correlation or competing peaks are rejected. Test sounds never enter a practice score. Song playback/jams cannot run alongside the check; cancellation, permission denial, hidden pages, navigation and audio interruption release its analyser and scheduled sources. Microphone processing constraints remain the same for calibration and singing; the app does not turn off echo cancellation just to force a result.

Only the timing number, quality summary, timestamp and audio-route key can be retained locally. Microphone waveform buffers are temporary memory, released after the check. No audio, route labels or calibration waveform is sent to Railway. Practice reports continue to use the existing derived-pitch result storage and permissions.

## How singing recognition works

After microphone permission, Web Audio supplies small waveform buffers. The local `vocal-pitch.mjs` detector uses a YIN-style periodicity calculation: it looks for a repeating waveform period, chooses the fundamental frequency instead of merely the loudest harmonic, and converts that frequency to a musical pitch. For example, 440 Hz corresponds to A4. This is ordinary signal processing on the phone, without a remote AI-model request.

The detector reads roughly 40–64 ms of sound at about 31 updates per second, requires two consistent detections and rejects quiet, irregular or clipped input. The app compares each confident pitch with the song’s single target note at the compensated capture time. The difference is measured in cents (100 cents per semitone); the green center currently allows ±35 cents. Comfortable-octave mode accepts the same melody in a higher or lower octave. The highway, current-pitch meter and derived report use these comparisons.

One nearby singing voice works best. Background vocals, room noise, growls, consonants, strong harmonics and vibrato can interrupt or confuse a pitch estimate. The guide assesses melody matching, not pronunciation, overall vocal quality or a medical property of the voice. Internet latency is outside the local detection loop; Railway serves songs and stores authorized derived results.

## Validation and limits

Signal tests use generated probes at 16/44.1/48 kHz with phase shifts, noise, echoes, competing probes and deliberately inconsistent timing. Controller tests cover output-clock compensation, replacing rather than duplicating input delay, saved/unknown routes, device invalidation, cancellation, pending permission, denial and refused jam checks. Browser QA uses an isolated silent Web Audio loopback and synthetic microphone route, including portrait/landscape phone viewports. No physical microphone or real Bluetooth phone is used by this automated QA. Headset trials on iPhone Safari and Android Chrome remain necessary.

Browser references: [playback latency and Bluetooth](https://web.dev/articles/audio-output-latency), [audible output timestamps](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp), and [estimated capture latency](https://w3c.github.io/mediacapture-extensions/). No schema, persistent volume, hosting-variable or runtime dependency changes are needed.
