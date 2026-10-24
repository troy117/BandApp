# Vocal accuracy and reports

Open **Vocals**, choose the song/backing and enable the microphone. Headphones help the phone hear the singer rather than the backing or melody guide. The **On pitch** meter shows overall accuracy for the current attempt. The existing **Pitch** guide shows whether the current note is high or low. Both remain visible in landscape focus; large lyrics supports the same meters.

With the mic on, **Pause & report** opens a summary. Stopping by another control or reaching the end also opens a report if at least 0.1 seconds of vocal melody was measured. Closing a report returns to practice; **View pitch report** reopens the latest report. Pausing/continuing or retrying a phrase starts a new attempt, with its own percentage.

The report includes:

- Overall on-pitch percentage and measured vocal seconds.
- Coverage: the proportion of the played vocal melody that was measured, making mic-off periods or interrupted sampling visible.
- Time singing low or high, and time with quiet/unclear input.
- A zoomable timeline: the green center band is on pitch, above it is too high, below it is too low. Gray sections were not measured. Pitch error uses cents; 100 cents is one semitone. Points beyond ±200 cents sit at the chart edge; CSV keeps their numeric error.
- Phrase summaries with **Try phrase**, plus **Continue song** or **Sing again** and CSV download. The selected backing and song revision are retained. Leave a teacher-led jam before retrying independently. Reopening another song may require enabling its microphone again.

Reports appear in the practice journal and, when signed in, school practice results. Existing permissions let the student, their assigned teacher and school owner review them. Guests/personal arrangements keep reports in the browser. Shared-session participation remains separate from these practice reports.

## How the percentage is calculated

Accuracy is **on-pitch time / monitored vocal-note time**, rather than one vote per video frame or per note. It uses the existing ±35-cent pitch tolerance. **My comfortable octave** accepts the melody an octave higher or lower; **Exact written octave** requires the written octave. Range and timing settings are fixed during an attempt; pause to adjust them.

Rests, count-in, the first 80 ms of a note, ambiguous overlapping pitches, mic-off periods and future notes are excluded. Quiet/unclear input while monitoring an eligible vocal note counts as not on pitch, and is reported separately from singing a wrong pitch. A frame gap longer than 250 ms is unmeasured; it does not invent a held note across a stalled/background tab. Only the part actually reached is included in a stopped report. A mic-off or lyrics-only attempt does not create a pitch report.

Pitch detail is summarized in cells up to 0.1 seconds long. Phrase-boundary summaries use those cells, so sub-frame boundaries are approximate. Automatic target melodies, harmonies, consonants, noise and backing leakage can affect practice feedback. These percentages describe pitch practice, not a formal singing grade.

Only derived pitch errors, durations and the existing song/phrase references are saved. Microphone audio is not recorded, stored or uploaded. School reports use the existing revision, result and backup storage; no volume replacement, schema migration or new hosting service is needed.
