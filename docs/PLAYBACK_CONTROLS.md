# Practice controls and classroom audio

Prototype 32, November 6, 2026.

## Vocals

Stop sits next to Play/Pause and returns the song to 0:00, whether playing or paused. The next Play starts a fresh count-in. Stop also cancels a pending audio load; it cannot later restart playback. Pausing retains the current position. Shared jam transport stays teacher-controlled, so individual vocal seek/pause/stop controls are disabled while joined.

## Automatic report display

Vocals, drums and keyboard each have a **Show report automatically** checkbox, also available in focus view. Unchecking keeps the practice screen open after stopping or completing an attempt. Reports are still calculated and saved under the existing rules; manual report/history buttons keep working. The choice is remembered per instrument in this browser, defaults to enabled, and is not an account-wide setting. The vocal setting also applies when pausing. Live scoring and classroom result delivery are unaffected.

## Choose the classroom audio device

1. Create a jam and assign the students. New rooms select the first assigned drummer as the audio device; rooms without a drummer select the teacher computer.
2. Under **Classroom audio device**, choose the teacher computer or an assigned student's joined device, then press **Use audio device**. Connect that device to the classroom speakers. One joined connection per account identifies the device.
3. Everyone presses Ready. Only the selected device downloads/schedules the backing and plays the count-in, optional metronome and app guides. Other devices run their charts, local pitch recognition and scoring silently. The teacher retains Start/Stop and live meters without classroom sound on their computer.
4. Change the device between takes, or apply a change to stop the current take. All readiness resets before the next start. Song/start-bar changes preserve the selected device. The selected device has the classroom playback-volume control.

No live instrument or microphone audio is streamed. Instruments with their own amplifiers/module sounds still use their own audio connections. With MIDI-only arrangements the selected device synthesizes the ensemble guide; with backing it plays the recording. A selected vocalist may enable its own melody guide on that output device. Guides on silent devices are disabled. A selected output losing connection, audio or readiness interrupts the whole take; another performer's interruption remains local. Ready messages explicitly confirm the selected output, so an older client must refresh instead of silently using the old teacher-only routing.

Room routing is ephemeral like existing rooms; take history records the selected account ID. No database schema, music, dependency, volume or hosting setting changes. Deployments end existing live rooms as before.

## Validation

Tests cover default/fallback selection, silent teacher/student playback, backing downloads, count-in/metronome/guide routing, teacher-only device changes, invalid/stale requests, readiness resets, selected-output disconnects, local interruptions, report retention and cancelling a pending vocal Play. Browser QA uses a separate synthetic school and the provided original exercises, with phone-size vocal controls, drum/keyboard focus view and teacher audio selection. Evidence is ignored under `artifacts/jam-audio-qa/`. Physical classroom speakers, phones, Bluetooth output delay and actual kit inputs still require the classroom trial.
