# Instrument pages, piano scores and the sync workspace

Choose Keyboard, Guitar, Bass or Vocals from the instrument menu. The chosen area determines the part; Your part is only shown in the student jam area, where assignments also come from the teacher. Song choices include the parts available for that instrument. The old introductory banner and manual song-refresh button are removed. The school list refreshes at sign-in, on entering an area, and when returning to the browser. Refreshing retains the loaded song rather than loading a different arrangement during practice.

Keyboard opens **Full sheet · piano**, with Note highway still available under View. The full score has treble/bass staves, chords, accidentals, rests and ties across bars. The gold playhead follows the same performance clock and follows rows during playback. Scroll while stopped to review other bars. Size and optional Note names controls stay inside fullscreen. Dense bars can scroll sideways instead of shrinking their notes. A viewport-sized canvas renders only the visible rows.

This score is generated from MIDI. Pitches and judging times remain exact; durations are rounded for reading, short articulation gaps are omitted, and pitches below middle C use the bass clef. Original hand assignments, beaming, enharmonic spelling and publisher engraving are not recovered. Accidentals are shown explicitly, without an inferred key signature. MIDI tempo/meter changes and section repeats retain their clocks.

## Teacher workspace

Teachers have a **MIDI & audio sync** sidebar item and account-menu shortcut. Choose an existing school song or New arrangement to import MIDI. Audio & backing and Parts & lyrics remain tabs in this workspace. The editor is hidden on instrument and Jam pages, with its unpublished draft retained when changing areas. Student accounts have no sync menu; publishing permissions still belong to the owner or publishing teacher.

Compare against any assigned part with notes: drums, keyboard, guitar, bass or vocals. Switching the reference keeps the current waveform position. Use Earlier/Later, the recording scrollbar, horizontal dragging, or the mouse wheel over the waveform to move through it. Zoom +/− or Waveform window changes the detail around the current view. A click selects a cursor or MIDI attack; choosing a marker and Apply beat match still fits the offset. Two-point matching corrects steady drift.

## Reversible recording cuts

Start at and End at use seconds in the original recording. Blank End at keeps the original end. The waveform dims excluded audio. Buttons set either boundary to the waveform cursor; Use whole recording restores the full file. **Align start to selected MIDI beat** maps the kept start to the selected bar/beat. Changing a cut by itself does not move the MIDI alignment.

Preview recording/together respects the cuts. Publish school song update saves optional `audioStart`/`audioEnd` alongside the existing offset and speed. Both individual and shared backing playback, seeks and repeated sections honor the range. The MIDI, lyrics and original recording bytes remain intact. Existing songs without range metadata use the full recording; no automatic song revision or data migration is performed. Setup export/import and drum/device-library round trips preserve the optional range fields.

Added/missing bars or changing live tempo still cannot be repaired by a single global offset/speed. Use a matching arrangement or shorter sections when required.

Validation includes grand-staff chords, cross-bar holds, rests, dotted/triplet durations, exact clock interpolation, finite responsive layout and viewport rendering. Range tests cover offset signs, seeking, repeats, server validation and previews. Isolated teacher/student browser trials use generated music and accounts, including publish/reopen of unchanged audio with cuts. No production music is republished during this release.
