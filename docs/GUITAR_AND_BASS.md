# Guitar and bass practice

Choose Guitar or Bass, then a school song. Songs with several guitar parts show
a **Guitar part** selector. A single-part song does not show an extra selector.
The selector remains available in focus view. Switching backing versions keeps
the selected guitar part.

Use the song-position slider, or enter a bar and press **Go**. **Listen here**
starts there with a synthesized guide and the selected backing. **Pause** keeps
your position. **Play part** follows guitar/bass without scoring. Keyboard and
drum scored attempts start fresh; their Listen mode can seek and pause.

Open **Practice a section**, choose From/Through bars and 1, 2, 4 or 8 passes,
then enable **Repeat selected bars**. Each pass restarts the matching recording
segment and preserves internal tempo/meter changes. Loops stop after the chosen
passes (20 minutes maximum). Silent guitar/bass measures can be included. The
controls remain in focus view.

Unscored solo listening continues when the tab is hidden or the window loses
focus. Backing playback is scheduled in Web Audio independently of animation;
the hidden-tab scheduler looks farther ahead for clicks and guide notes. Scored
attempts and shared takes retain interruption rules. Phone operating systems can
still suspend a browser or interrupt audio, especially with a locked screen;
background/lock-screen playback is not guaranteed. Focus view requests the
existing screen wake lock.

## Original tablature and tuning

MIDI exports do not retain the original string, fret or technique notation.
Legacy imports therefore use estimated fingering. Teachers can assign separate
lead/rhythm tracks and select Standard or Drop D in **MIDI & audio sync → Parts**.
Changing tuning preserves sounding pitches and recalculates frets on the source
strings, rejecting impossible results.

Prepared original tablature retains note times, sounding pitches, strings,
frets, tied durations, palm muting, dead/ghost notes and slide/pick-scrape marks.
Both the highway and full tablature show **P.M.**, **sl.**, **×** and **scrape**.
The synthesized listening guide does not model guitar articulation realistically;
the selected recording remains the reference for those sounds.

To prepare your own matching Guitar Pro `.gp` ZIP archive (not older `.gpx` or
binary `.gp5` files):

```sh
python scripts/read-guitar-pro.py song.gp quarters.json
node scripts/prepare-fretted-guide.mjs song.mid quarters.json fretted-guide.json
```

Choose **Import original tablature** with the matching MIDI loaded. It replaces
the guitar/bass assignments in the draft; other parts and audio are retained.
Check the results, then publish. The MIDI fingerprint, score length, strings,
frets, pitches and note bounds are validated. This converter requires unfolded
repeats and no capo; it rejects those cases instead of guessing. It does not yet
import every Guitar Pro engraving/effect. Changing a source part's MIDI track
assignments removes its imported fingering so stale tablature cannot override a
new assignment. Arrangement setup downloads preserve the separate parts and tabs.

The song library stores only user-provided files; source music and prepared score
data are not bundled in the repository.

## Pickup and changing meter

MIDI time signatures and tempo changes are retained. **Pickup length (quarter
notes)** adds a short first measure when the MIDI export omitted that information;
0 means a complete first bar. Quarter-note units allow fractional beats and
eighth-note meters. This changes bar/beat labels and clicks, preserving absolute
note times, lyric timings and backing-specific maps. A pickup must be shorter than
the opening full bar. Dreams uses a 1.5-quarter pickup followed by 4/4.

The October 26 library review separates the source guitar parts for Dreams,
Still Into You and Ocean Avenue; the latter retains an additional clean guitar.
Still Into You/Ocean Avenue use Drop D guitar and bass. Ocean Avenue's bass is
corrected one octave down against the original isolated bass (132 sampled notes);
its final low D was already correct. Future arrangements may require their own
source/recording review rather than a global transposition.
