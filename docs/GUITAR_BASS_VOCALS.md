# Guitar, bass and vocals — Prototype 12

October 22, 2026. This release adds follow-along parts; drums and MIDI keyboard retain their existing scoring.

## Use it

Choose Guitar, Bass or Vocals in the practice-area bar. Full band warm-up is an original five-part example. Guitar and bass offer a string-and-fret highway and Tablature view, with fullscreen and Play/Stop. Standard tuning is six-string E A D G B E for guitar and four-string E A D G for bass; frets 0–24 are supported. Fret 0 is an open string. The highest string is at the top. Numbers are suggested positions, not the original guitarist's fingering. Notes outside the supported tuning/range or chords that cannot be assigned to distinct strings remain visible with a question mark rather than being silently transposed or removed.

In Song library, use Edit instrument parts for an existing school song. Assign tracks to Drums, Piano / Keyboard, Guitar, Bass or Vocals, leaving other tracks on Ignore. Recognizable new guitar/bass tracks are suggested from MIDI names and General MIDI programs. Existing explicit assignments remain authoritative until the teacher publishes an update. The existing backing, volume, offset, MIDI speed and drum map are retained; publishing creates a revision of the same song. Previous files and results remain.

The library offers Practice guitar, Practice bass and Lyrics for prepared parts. Use the same school song in Jam session. Add student expands the roster to eight seats; empty seats are ignored, students must be distinct, and each uses their own computer/account. All students and the teacher press Ready before the shared count-in. Guitar, bass and vocal students follow the transport without connecting an input. Teacher cards show their song progress and connection state. Completion is saved as unscored participation in Recent shared takes, with no hit/miss/accuracy data and no zero-score practice attempt. Drum/keyboard results remain separate scored attempts. Server restart ends active rooms and retains completed take records.

## Where lyrics come from

Standard MIDI files can contain Lyric Meta Events, but MIDI melody notes alone contain no words. The [MIDI Association's lyric-event recommendation](https://midi.org/smf-lyric-meta-event-definition) describes the event convention and notes incompatible implementations. This release reads explicit lyric events and a limited fallback for text events in named lyric/karaoke tracks, choosing one stream rather than combining duplicate language/voice tracks. It groups syllables into line-level cues using line markers and timing gaps. Track names, tempo markers and ordinary text are not treated as song lyrics. Complex XF extensions, multiple lyric languages, exact syllable highlighting and unusual character encodings may need a corrected lyric file.

In Edit instrument parts or Prepare band song, open Vocals and timed lyrics. Embedded MIDI words load for review when present. Otherwise load an LRC, basic WebVTT or SRT file, or enter timestamped lines. A vocal MIDI melody track can be assigned, but actual lyric text must be supplied for the vocal view. A lyrics-only part does not need a selected note track; it shares the uploaded song's MIDI timeline.

LRC-style original example:

    [00:00.000]Find the beat
    [00:06.000]Keep it steady
    [00:12.000]Listen to each other

[WebVTT](https://www.w3.org/TR/webvtt1/) is the browser timed-text standard and supports explicit cue start/end times, including instrumental gaps. LRC is a simpler editable line-start format. The app also reads common SRT timing blocks. Payloads render as text, not executable HTML. Files must fit the 10 KB lyric-text limit; the MIDI chart remains limited to 20 minutes. Teachers supply their own lyric files/text; the app does not fetch commercial lyrics or infer/transcribe words from an MP3.

Choose the timestamp clock:

- MIDI song time: lyric times follow MIDI speed. Embedded MIDI lyrics use this clock.
- Backing recording time: lyric times follow the recording's saved audio offset, independently of MIDI speed. Imported timed-text files default to this clock. For example, a lyric at recording time 12 seconds with backing offset +0.5 appears at song time 12.5 seconds.
- Lyric adjustment: an additional positive adjustment displays lines later; a negative value displays them earlier. This changes lyric display, not the audio or instrumental notes.

Review the current/next lyric line with playback before publishing. VTT/SRT explicit end times preserve silent gaps. LRC lines normally remain active until the next cue; the final line has a bounded tail. The vocal screen has fullscreen, a current-line progress indicator and upcoming text. It does not request microphone access or score singing.

## Why generated tab is a suggestion

MIDI describes the played pitches and timing; a pitch can appear at multiple string/fret positions. The app uses a bounded fingering search to avoid assigning simultaneous notes to the same string and to favor nearby frets/open strings. It does not recover bends, slides, capo choices, picking technique or the original score. Sustained overlaps may require a teacher's fingering adjustment. [MusicXML tablature](https://www.w3.org/2021/06/musicxml40/tutorial/tablature/) explicitly stores fret and string information, so importing MusicXML/Guitar Pro is the recommended future step for preserving original tab rather than estimating it.

## Next milestones

1. Classroom trial with one teacher, scored drum/keyboard students and unscored guitar/bass/vocal students; verify shared count-in, long-song drift, lyrics and retained results.
2. Teacher-selected alternate tunings, five-string bass, capo and a fingering editor, followed by MusicXML/Guitar Pro import for exact tab.
3. Easier lyric line timing by tapping along to backing audio, multi-language streams and syllable highlighting.
4. Optional guitar/bass input and vocal assessment only when requested; they are outside this follow-along release.

No database schema migration, new volume or extra Railway variables are required. Keep the current persistent school storage and domain configuration.
