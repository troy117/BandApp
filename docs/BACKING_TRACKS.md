# Backing versions

Teachers: open **MIDI & audio sync**, choose a school song, then **Add another backing**. Choose the audio file, give it a short student-facing name, and calibrate its offset/MIDI speed and start/end cuts. Compare it against drums, keyboard, guitar or another assigned part. Preview the beginning and a later section. Switch **Backing version** to return to another recording; its settings are retained. Choose **Default for students**, then publish the school song update to save all recordings together.

Students: choose **Backing** beside the song. The same selector travels into phone focus view. Switching stops playback and loads the selected recording's note and lyric timing. Songs with one backing keep the simple layout. In a jam, the teacher chooses the backing in session setup or Song and playback; students use that shared clock and press Ready again after a change.

Up to six recordings, 100 MB each and 300 MB combined. Every file uploads before a revision is published. Older revisions and original files remain available. School backups include every backing file. Legacy single-recording songs remain readable.

Simple calibration uses an offset and a steady tempo adjustment. Prototype 22 also supports an independent timing map for changing tempo in each backing. See [recording alignment](RECORDING_ALIGNMENT.md). Added/missing bars still need arrangement review; a map cannot invent or remove MIDI notes. Student performance reports use the selected backing's timeline. Microphone recordings remain local and are not uploaded.

Lyrics normally follow MIDI time. Recording-clock lyrics retain a reference alignment when versions change, including existing word timestamps. Arrangement setup export/import applies to the selected backing; publish saves all backing versions and their calibrations.

## Alignment tools

Open **MIDI & audio sync** in the teacher sidebar or account menu and choose a school song. The **Audio & backing** shortcut in the library opens the same workspace. The editor also has a **Parts & lyrics** tab. See [piano and sync controls](PIANO_AND_SYNC.md) for waveform scrolling/zoom and reversible recording start/end cuts.

1. Import the replacement MP3 or other browser-supported audio file. The current file name and recording/MIDI lengths appear above the tools.
2. Choose the instrument to compare against. Drums are a useful starting point for music with clear attacks; pitched parts and vocal melodies also offer waveform markers and guide notes.
3. Choose **Suggest alignment** for starting candidates. Apply one and preview it; a repeated groove can match the wrong bar. Nothing is published automatically.
4. For a manual match, select a MIDI note marker or enter its bar/beat. Click the corresponding attack in the waveform or enter its recording time, then choose **Apply beat match**. The two-second window and 50 ms nudge buttons allow finer adjustments.
5. Use **Preview together · 8 sec** to hear the unchanged recording with a metronome and optional guide notes. Background volume is adjustable. Check near the beginning and in a later section.
6. If the start matches but later beats drift steadily, enable the second match and identify a corresponding later beat in both files. This fits one overall tempo difference. Added/missing bars or changing performance tempo require a matching arrangement or further editing; offset and a single speed adjustment cannot repair those differences.
7. Choose **Use arrangement locally** to try the draft. **Publish school song update** shares the replacement audio and alignment with students as a new revision of the same library song. Done closes the editor without publishing; reopening from the library loads the saved revision.

Positive recording offset delays the audio. Negative offset skips its intro. For example, MIDI time 0 matching audio time 1.2 seconds needs offset −1.2. MIDI speed follows the recording while the audio retains its original speed and pitch. The waveform and beat-match fields use the same clock.

MIDI-timed lyrics, including saved word timestamps, move with MIDI speed. Lyrics tied to recording timestamps should be reviewed after replacing that recording. Publishing retains the instrument assignments, MIDI bytes, lyric text and lyric clock unless the teacher explicitly edits them. The drum Song setup uses the same sync controls.

Preview playback stops when the editor closes, the page hides/loses focus, the account or practice area changes, or a new file/reference is selected. Stopping during audio initialization prevents a delayed preview from starting. Students can practice the saved backing but have no audio-management controls. Publishing permissions remain enforced by the school backend.

Validation uses original generated music plus a private local copy of the user's Sinatra backing. The local publish/reopen check compares MIDI/audio bytes and retained assignments/word-timed lyrics. The downloaded backing runs about 3:04 versus the MIDI's 2:28; its automatic candidate remains a starting suggestion, not an audibly confirmed full-song match. A teacher should compare sections before publishing it. No private music or lyrics are included in Git.
