# Recording timing and vocal-stem guides

Each backing version can keep its own timing map. Songsterr audio can continue using its existing offset and speed. Selecting an original recording loads that recording's map for every instrument, lyric word and metronome beat. Audio plays at its normal speed and pitch; MIDI display and guide scheduling follow the recording.

In the teacher's **MIDI & audio sync** workspace, add or select a backing and load its **Timing map** JSON. The import checks the exact MIDI fingerprint and audio filename/byte length. Preview several sections. To refine a point, choose the MIDI bar/beat and matching recording time, then **Save selected beat as an anchor**. Anchors must remain ordered. The offset nudges the whole map; individual anchors adjust local timing. Download exports the current map, including that nudge. **Use simple alignment** replaces the map in the draft with one overall speed. Publish saves the chosen backing's settings without changing other versions.

**Import vocal pitch guide** on the **Parts & lyrics** tab accepts `bandapp-vocal-guide` version 1 JSON for the matching MIDI fingerprint. Notes are `{time,duration,pitch,velocity}` in the unchanged MIDI timeline. They provide a monophonic target melody when the MIDI has no vocal track. Optional `lyricsText` is canonical MIDI-time VTT with word timestamps, applied only to the currently selected backing. Import it separately into other recordings that share that timing. The base lyric editor retains the original text. **Use base lyrics for this backing** removes only the optional override. Publish makes the draft available to students.

## Run the analysis locally

Python and model packages are optional preparation tools. They are not production dependencies. Keep private recordings, lyrics, stems, environments, model caches and generated reports under an ignored directory such as `artifacts/`.

1. Create a Python environment and install `scripts/requirements-alignment.txt`. SyncToolbox 1.4.2 uses 50 Hz chroma and DLNCO onset features to align the MIDI-matched synthesized recording with the original recording.
2. Create a private JSON manifest array. Each entry has `key`, `fingerprint`, MIDI `duration`, optional `synthOffset`, and absolute paths for `reference` (the MIDI-matched synth), `original`, `instrumental` and optionally `vocal`. Obtain the fingerprint/duration using BandApp's MIDI parser. The original and instrumental must share the same musical timeline; the script checks their duration and onset correlation.
3. Run `python scripts/align_backing.py --manifest artifacts/manifest.json --output artifacts/alignment`. Use `--song "Song title"` to select a song, or `--force` to recompute existing output. Feature caches stay private. Review each quality report and the map before importing its `*-original-map.json` or `*-instrumental-map.json` into the matching backing.
4. For missing vocal notes, use a separate Python environment with `scripts/requirements-vocals.txt`. Run `python scripts/extract_vocal_guide.py --manifest artifacts/manifest.json --output artifacts/alignment --song "Song title" --detector crepe`. This analyzes the completed Demucs vocal stem locally and inverts the recording map to store pitches on the MIDI timeline. The conservative pYIN detector remains available as `--detector pyin`.
5. Word timing can be prepared locally with stable-ts forced alignment of the supplied lyric text against the vocal stem. Long gaps and repeated phrases often require separate bounded alignment passes. Convert recording timestamps back through the map before adding `lyricsText` to a guide. Do not import zero-duration words or assume a whole-song alignment is correct without review.

## Limits and review

Automatic alignment can choose the wrong repeat, especially in solos, repeated choruses and fade-outs. The scripts extend stable local tempo across unreliable endpoint padding, but every map still needs section checks. A monotonic timing map cannot represent omitted or reordered sections, create missing notes, or remove added bars. Edit the recording or arrangement when those structures differ. Small waveform refinements are supported; a map is not proof of a perfect musical match.

Vocal pitch extraction is a draft melody reference. Harmonies, duet singers, breaths, slides, instrumental leakage and octave errors can affect the result. Word alignment also estimates overlapping ad-libs. Review those passages against the stem and use the student's octave control when appropriate. These guides do not create a vocal grade or upload student microphone audio.

Source media and lyrics remain outside Git. Publishing uses the existing school revision/backup mechanism and retains earlier revisions. Keep the current Railway data volume attached across deployments.
