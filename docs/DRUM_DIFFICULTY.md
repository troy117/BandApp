# Easier drum parts

Open a school or imported MIDI song in **Drums**, then choose **Drum difficulty**
beside the backing selector. The same selector is available in focus view.
Built-in teaching grooves already have their own levels and keep their existing
patterns. Individual MIDI practice offers:

| Level | What the student plays |
| --- | --- |
| Beginner | Closed hi-hat pulse, main snare notes and widely spaced kicks; three kit lanes. |
| Easy | Eighth-note or swing hi-hat pulse, main snare notes and fewer kicks; three lanes. |
| Intermediate | Fewer kick bursts/ghost notes, a single tom for shorter fills, simpler cymbal combinations. |
| Original | The complete imported, mapped drum-kit part. |

The two easiest levels let students use closed hi-hat for ride, open-hat and crash
positions. Intermediate folds tom fills onto floor tom. Pedal hi-hat is omitted
from simplified versions. Only the selected difficulty/focus kit pieces are
scored; their extra hits still count, while omitted kit pieces are unscored.
The original backing recording can still contain the full drum arrangement.
Enable **Guide drums** and lower backing volume to hear the simpler pattern.

All retained attacks stay at their source positions. Tempos, pickups, meter
changes, bar boundaries, backing-specific alignment and the song's duration stay
the same. No notes are snapped to a new grid. Compound pulses such as 12/8 and
swung eighths are recognized. Straight-meter kick triplet bursts are reduced;
completely silent bars stay silent. A fill-only bar can become one snare cue at
an existing attack instead of disappearing entirely.

Simplify the whole part before section/focus filtering, so a loop uses the same
reduction as the whole song. The choice is remembered on this device, locked
during a take, saved with reports/history, and restored by Retry or report-based
practice. Original is the default. Shared jam arrangements retain their teacher's
original assigned parts; this selector applies to individual drum practice.

These are automatic teaching reductions. A simple source groove can have very
similar Easy/Intermediate versions. Fast songs retain their original tempo, so
start with short loops. A teacher should audition each exercise for musical use.

## Export a folder of drum MIDIs

The command below creates four drum-only MIDI files per input song, a comparison
CSV, a manifest and a short guide. It reads the top-level `.mid`/`.midi` files,
prefers named drum-kit tracks over auxiliary percussion, and refuses to overwrite
existing output files.

```sh
node scripts/create-drum-difficulties.mjs "input folder" "new output folder" [pickup-fingerprints.json]
```

Optional pickup data maps the original MIDI fingerprint to its opening length in
quarter notes. For a known pickup, the export encodes a short first measure and
then restores the normal meter. This preserves the attack times and full duration
without changing the original MIDI. Exported files retain every source tempo and
subsequent time-signature change. They contain only the application's mapped drum
kit: melodic instruments and unmapped auxiliary percussion are omitted. Backing
audio is separate. No user music is bundled in the repository.

The November 6 batch contains all eight source-folder songs and 32 validated
drum-only MIDI files. Generated music and the detailed per-song census are ignored
under `artifacts/`. No school songs, visibility settings or backing tracks need
to be republished to use the individual-practice selector.
