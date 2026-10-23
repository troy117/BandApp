# Session controls and lyric timing — Prototype 14

October 22, 2026. Version 0.14.0; no database migration, new volume or hosting variables.

## Keep one session for a lesson

Create a session with the existing student accounts. End session is now a prominent button at the top of the current teacher room. Teachers can also end their rooms directly from the session list, including rooms they previously left. Leave session disconnects the teacher; End session closes the room for everyone and removes its invitation. Previous results remain available.

Inside the room, Song and playback contains Session song, Start from bar and the part assigned to each student. Select a song, check every student's part and choose a source bar. Apply song / start bar stops any current take and keeps the same students and their connections. It clears readiness; everyone checks sound and presses Ready again before the teacher starts a new count-in. A missing instrument requires an explicit new part selection. Refresh school songs before changing to newly published material.

Stop playback returns the room to preparation. Prepare next take repeats the current song/start bar. To resume elsewhere, choose another starting bar and apply it. This implements a restart from a source bar; continuous scrubbing and pause/resume are later work.

All performers use the same cropped timeline. Tempo/meter at the selected bar determines the count-in. Backing audio starts from the corresponding recording position, including the saved offset. A lyric already active at the selected boundary remains active for its remaining interval. Reports retain original bar numbers and count only the selected section; a late start is not a complete-song best. Parts resting throughout the selected tail still follow the transport without creating an empty practice-history attempt.

## Consistent drum highways

Solo and jam drums use one renderer, including the perspective, note shapes, timing boxes, labels, key hints and saved lane order. Closed hi-hat has its own labelled box. Open notes use a separate adjacent OPEN HAT box and hollow notes when MIDI pitch 46/26 or an explicit open articulation is present. Pedal hi-hat stays with closed hi-hat. Built-in exercises without an open articulation retain the closed lane.

These are display lanes. Both use the existing hi-hat controls/judge; this release does not grade pedal openness. Drum notation, pad learning and keyboard mappings retain their meanings.

## Time supplied lyrics

Use Song library → Edit instrument parts → Vocals and timed lyrics. Existing MIDI, backing and instrument assignments load before editing.

Load an LRC, WebVTT or SRT file to use supplied timings, or load a plain .txt file / paste one lyric line per row in Time plain lyrics with the recording. Choose Start line timing, play or seek the matching recording, and click Mark next line when each line starts. End current line marks an instrumental gap; Undo last line allows a correction. After all lines have a start, Use timed vocal part prepares WebVTT using recording timestamps. Preview Vocals, then Publish school song update. The vocal part becomes available to individual students and as a jam assignment.

Timing uses the exact retained recording. It does not infer words from audio or promise automatic alignment. Supplied reference timings need a listening check. The current song timeline ends at the MIDI end: cues starting later remain in the saved text but do not appear during playback. Correct timing or the source arrangement before relying on a complete karaoke performance. No private school music or supplied lyric text is bundled in Git or the standalone app.

## Lead-vocal melody guide

Assign the actual lead-vocal MIDI tracks to Vocals in Edit instrument parts, retaining the timed text. The Vocals screen shows the lyrics plus a scrolling treble staff, literal note names/octaves, the current target and shaded hold lengths. Play melody guide supplies an optional local synthesized reference tone. It does not request a microphone, assess the singer or add scores. Text-only vocal parts continue to work when no melody tracks are assigned.

The Songsterr Dreams vocal sheet labels the lead-vocal track as Flute; Ocean Avenue uses Clarinet, Still Into You uses Soprano Sax and Master of Puppets uses Baritone Sax. Select every channel of the named lead-vocal track and leave backing vocals separate. Existing note-on/release times and tempo scaling supply the guide. Publisher note spelling, expressive singing, ties and syllable placement are not recreated from MIDI. Use the visible score's lyric anchors and a listening check to refine the separately retained lyric cues; assigning melody tracks does not change those timings or the backing alignment.

## Validation

137 tests cover reusable rooms, permission checks, stale controls, readiness, section totals/persistence, source bars, tempo changes, backing slices, lyric carry-over, empty parts, hi-hat routing/drawing and marked lyric gaps. Browser checks use synthetic accounts and original music for room changes/end, open/closed targets and line timing. Real kit/pedal behavior and audible synchronization across student computers remain classroom checks.

Separately authorized school-song updates use the matching Songsterr score revisions and the user's supplied lyrics. All four MIDI fingerprints match the retained school files; 1,845 rendered lyric anchors match active lead-vocal MIDI pitches. The revised line cues fit inside each source timeline, and saved publications were reopened to verify lyrics, selected lead channels and retained settings. Ocean Avenue's extra supplied outro is excluded from timed playback at the user's request. Private score/lyric data is ignored under artifacts/, outside the app distribution. The live lyric changes are independent of deploying the new melody-guide code.
