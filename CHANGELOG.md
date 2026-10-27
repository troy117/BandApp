# 0.28.0 — Guitar parts, original tablature and listening controls

- Select separate guitar parts, retaining that choice when changing backing. Teachers can name additional parts, choose Standard/Drop D tunings, import prepared original tablature and preserve it through publication/setup export.
- Display source strings/frets, tied holds, palm muting, muted/ghost notes, slides and pick scrapes in the highway and full tablature. Sound pitches remain separate from fingering; legacy MIDI-only imports retain explicit estimates.
- Seek to a time or bar, pause and listen to repeated bar sections, including guitar/bass rests. Focus view keeps song/part/seek/loop controls. Crop resumed loop audio so earlier passes do not replay over the current pass.
- Unscored solo listening survives tab/window changes; scored/shared sessions retain interruption rules. Mobile OS suspension remains outside the browser's control.
- Restore a missing short opening measure without changing absolute note/lyric times or independent backing maps. Retain subsequent tempo and meter changes in clicks, bar labels and loops. The source review identifies Dreams' 1.5-quarter pickup, Drop D parts for Still Into You/Ocean Avenue, and Ocean Avenue's bass octave against the isolated original recording.
- No database schema, dependency, Railway setting or volume changes. See [guitar and bass practice](docs/GUITAR_AND_BASS.md).

# 0.27.0 — Automatic headphone timing check

- Check timing beside the vocal microphone guides students through a short five-chirp acoustic check, measures the delay and applies it automatically. No singing, reaction-time tapping or numeric adjustment is needed. The microphone must be able to hear an earpiece.
- Require at least four clear, consistent matches; missed/ambiguous/unstable signals leave previous timing unchanged. Cancel, permission denial, navigation, hidden pages and audio/device changes have explicit handling; calibration cannot mix with a song or teacher-led jam.
- Measured timing replaces the estimated input delay rather than adding it twice. Extra delay resets to zero. Known audio profiles save on this device with expiry and a clear action; unidentified headphone outputs are reused for the current visit only. Raw audio is never stored or uploaded.
- No backend, database schema, dependency or Railway setting changes. Automated signal/lifecycle tests and silent synthetic browser loopback cover matching, noise rejection, output-clock compensation, persistence, cancellation and phone layouts. Physical Bluetooth phone testing remains necessary. See [microphone timing](docs/MICROPHONE_TIMING.md).

# 0.26.0 — Faster vocal feedback

- Shorter microphone analysis windows, 32 ms updates and current confirmed pitch reduce software delay. The live cursor stays on the sing line; its historical trace and reports preserve capture-time alignment.
- Capture timestamps include reported input latency (80 ms fallback), consistent quiet-frame timing and saved optional extra correction. All 223 tests, syntax and standalone export passed.

# 0.25.0 — Organized song library and teacher-only songs

- The desktop song library uses compact rows, sticky headings, title/file search, instrument and student-access filters, sorting and a single part picker/Practice action. Editing, audio/backing and recoverable archive tools sit under Manage. Phone layouts use stacked rows and retain the student’s default part when available.
- Song owners and the school owner can choose Students & teachers or Teachers only. School catalogs, direct metadata, all current/historical MIDI/audio downloads and arrangement requests enforce student access, including cached arrangements. Teacher-only songs remain available to staff; active student jam sessions must end before hiding their song, and private songs cannot be assigned to new jams.
- New publications can start teachers only. Publishing later edits and archive/restore preserve current visibility. Access flags use the existing private school settings table and backups; no schema or hosting-setting migration is needed. Existing songs keep their prior visibility until explicitly changed.
- Validation: 218 automated tests, module syntax and standalone export; isolated teacher/student browser checks cover search/filtering, visibility saves, archive/restore, part routing and desktop/phone layout.

# 0.24.0 — Compact teacher classroom

- Teacher rosters use aligned desktop rows for names, default instruments, recent match rates, attempt counts, last practice and Results. Sticky column headings and a scrollable roster keep larger classes readable. Phone-sized screens retain stacked, touch-friendly rows.
- Search names/usernames, filter by instrument or active/inactive accounts, and sort by name, latest practice, match rate or attempts. Counts show the full class and current matches; filters survive returning from Results or refreshing the roster.
- Add account opens from the roster header. Password and enable/disable controls move into each row’s Manage disclosure. Default instrument edits show pending state and restore the saved choice after a failed request.
- No account, music, result, schema or hosting-setting migration is required. Validation: 215 automated tests, module syntax and standalone export; isolated browser checks use a synthetic 29-account class.

# 0.23.0 — Vocal accuracy and practice reports

- A second vocal side meter tracks time on pitch alongside the current-pitch guide in both highway and large-lyric views. Phone landscape focus keeps overall accuracy on the left and live pitch on the right.
- Mic-on attempts open a pitch report when paused/stopped or completed. Reports show measured-time accuracy, coverage, high/low/quiet/unclear time, a zoomable pitch timeline, phrase summaries, phrase retry, continuation and CSV export. Rests, new-note grace, mic-off gaps and future notes are excluded.
- Derived pitch reports reopen from the practice journal and school results with existing student/teacher access rules. Shared vocal participation stays separate from the private practice report. Microphone audio is neither recorded nor uploaded. No database schema or hosting-setting changes.
- Validation: all 212 tests, syntax and standalone export pass. Isolated student browser checks cover live meters, stopped/completed reports, saved-report reopening, phrase retry, CSV and phone portrait/landscape layouts with generated pitch input. Physical microphone accuracy still depends on the device and singing conditions. See [singing reports and calculation details](docs/VOCAL_REPORTS.md).

# 0.22.0 — Recording timing maps and analyzed vocal guides

- Each backing can use a piecewise MIDI-to-recording timing map. Notes, releases, beats, tempo, lyrics/words, previews, loops and shared starts follow the selected recording; audio speed and pitch stay unchanged. Simple Songsterr calibration remains supported.
- Teachers can import/export maps, refine beat anchors and return to simple alignment in MIDI & audio sync. Imports check the exact MIDI fingerprint and backing filename/size.
- Optional vocal-guide imports add canonical pitch notes and backing-specific word timing while preserving base lyrics and existing MIDI assignments. Shared seeks now shift word timestamps as well as lyric lines.
- Local Python tools use SyncToolbox for recording alignment and optional CREPE for vocal-stem pitch extraction. No Python, models or source media are added to Railway. See [workflow and limits](docs/RECORDING_ALIGNMENT.md).

# 0.21.0 — Multiple backing choices

- Named backing versions with student/focus selection and teacher-controlled jam choice.
- Independent offset, MIDI speed, volume and trim settings for each recording, preserving MIDI and word-timed lyrics.
- Atomic uploads, legacy compatibility, variant-aware results and complete school backups.

# Changes

## 0.20.0 — October 23, 2026 — Piano score and dedicated sync workspace

- Instrument pages select their own part, filter compatible songs and refresh the catalog automatically. Removed the introductory banner, redundant part picker and manual song-refresh button from individual practice.
- Keyboard adds a full MIDI-generated piano grand staff with chords, rests, cross-bar ties, accidentals, size/note-name controls and a following playhead. The highway remains available. MIDI pitches/judging clocks are retained; rhythm engraving and the middle-C staff split are approximate.
- Teachers have a separate MIDI & audio sync sidebar/account section. Its song picker and audio/parts tabs replace the editor under practice areas. Waveforms support scrolling, dragging, wheel navigation, zoom and reference-part changes without losing the viewed location.
- Optional start/end cuts save alongside alignment, retaining original audio bytes. Preview, solo/shared playback, seeks, loops and setup/device-library round trips honor the cuts. No schema, production song revisions or hosting-variable changes are required. See [usage and limitations](docs/PIANO_AND_SYNC.md).
- Validation: 194 tests, syntax and standalone export pass. Isolated student/teacher browser trials verify part selection, full piano score, hidden editor on practice/Jam pages, waveform navigation/reference switching, responsive layout, and publish/reopen of recording cuts with byte comparisons.

## 0.19.1 — October 23, 2026 — Focus sound controls

- Vocal focus toolbars include Metronome and Melody guide checkboxes for teachers and students in both vocal views. Existing controls move into focus and return to their settings panels without losing state. Songs without vocal notes show an unavailable melody guide.
- Instrument focus includes its metronome. Drum fullscreen includes Metronome and Guide drums; both can change during playback. Keyboard focus navigation includes the checkboxes. Compact portrait controls use a second row; landscape vocals retain the highway/lyrics and right-side meter.
- Validation: all 184 tests, syntax and standalone export checks pass. Isolated student browser trials verify live toggles, state retention, drum playback, and 390×844 / 844×390 vocal layouts. No school music, accounts, schema or hosting settings change.

## 0.19.0 — October 23, 2026 — Teacher backing-track editor

- Teacher account menus and editable school-library songs offer Audio & backing. The shared-song editor separates audio controls from parts/lyrics and supports replacement recordings, volume, offset and MIDI speed.
- Shared waveform/sync tools provide selectable note overlays, automatic candidates, one/two-beat matching, 50 ms nudges and eight-second recording/click/guide previews. Drum and pitched references are supported. Applying a match centers the waveform on its selected beat. Recording/MIDI length comparisons help identify different arrangements; audio pitch remains unchanged.
- Drafts stay local until publication. Updates retain MIDI bytes, assignments and word-timed lyrics; student controls and backend permissions remain unchanged. Pending previews are cancelled on stop/close.
- Validation: 184 tests pass. Syntax, standalone export and isolated teacher/student browser checks pass, including a real MP3 import and a local publish/reopen with byte comparisons. The production Sinatra recording remains unchanged; the longer downloaded backing needs a listening/section check before publication. See [teacher backing setup](docs/BACKING_TRACKS.md).

## 0.18.2 — October 23, 2026 — Score-timed vocal words

- Inline WebVTT word timestamps now drive both large-lyric highlighting and horizontal highway word positions. Held words and gaps follow their saved times, including recording offsets and speed changes. Existing line-only cues retain their approximate sweep.
- Reviewed the four new school songs against their Songsterr arrangements. Superstition and Fly Me to the Moon receive score-based word timing. The estimated final Superstition refrain overlapped the score's extended preceding word; that unsupported refrain is retained privately as untimed text. A few unscored ad-libs remain approximate. Standard Gravity and Are You Even Real have no vocal/lyric track in their scores, so their reference-assisted line timing remains unverified at word level.
- Validation: 179 automated tests, module syntax and standalone export pass. Private music, lyrics and review maps remain outside Git. No schema, volume, account or grading changes.

## 0.18.1 — October 23, 2026 — Preserve ignored arrangement tracks

- Reopening a saved song keeps every explicit track assignment, including Ignore. Instrument suggestions apply only to a new MIDI import. This prevents ignored brass or guitar tracks from being added to the bass part when editing an existing arrangement.
- No saved song data, schema or hosting configuration changes are required.
- Validation: 175 tests, module syntax and standalone export pass. The saved Sinatra bass arrangement remains 269 notes; reopening the editor now preserves its explicit selections.

## 0.18.0 — October 23, 2026 — Phone practice and live class meters

- Mobile instrument selection joins the library/account header. Vocal songs move beside Focus view, backing volume sits beside Mic, and all fullscreen practice views offer song selection. Landscape vocal focus reserves most of the screen for Pitch highway or Large lyrics and keeps a pitch meter on the far right.
- Focus/fullscreen requests a screen wake lock, releases it on exit/hiding and requests it again on return. Status distinguishes a held lock from unsupported or denied requests.
- Active jam assignments add a top-menu shortcut. New teacher assignments choose each student's default instrument when available. The teacher's Jam screen shows live class meters instead of their own Band practice panel. Drum/keyboard accuracy reflects notes judged so far; vocal guidance is live and ungraded, guitar/bass remain unscored.
- Only current vocal state/cents is shared with the assigned teacher during an active jam. Audio stays on the device, no voice history or grade is stored, and students still receive only their own room participant. The microphone notice follows joining/leaving the room.
- Teachers can Delete and Restore their own shared takes. Student results/reports remain available; playing takes cannot be deleted. No database schema, school music/revision, mounted volume or hosting-variable change.
- Validation: 174 automated tests, syntax and standalone checks pass. Responsive browser trials with synthetic accounts/original music verify song selection inside vocal/keyboard/drum focus, volume, held wake locks, default assignments, live meters and delete/restore. Physical phone trials remain useful. See [MOBILE_CLASSROOM.md](docs/MOBILE_CLASSROOM.md).

## 0.17.0 — October 23, 2026 — Vocal highway and longer reference notes

- Vocal parts with melodies open a horizontal pitch highway: cyan note/hold bars, a white sing line, scrolling white/yellow lyrics and an optional measured microphone trace. Large lyrics remains available. Words use existing line timing and remain approximate. Pause/continue, seek, entrance preview, octave choices and teacher-led transport retain their clock and controls.
- Warm-up reference notes sustain for four seconds, followed by a brief quiet gap and four seconds to sing. A dedicated Target/You meter shows low/center/high guidance during the singing turn; reference tones and uncertain input stay neutral. Held-note feedback continues to reflect the current pitch after a successful match.
- Browser-local feedback remains opt-in and ungraded. No school music, accounts, saved revisions, persistent volume, schema or hosting variables are changed. See [VOCAL_HIGHWAY.md](docs/VOCAL_HIGHWAY.md).
- Validation: 165 tests cover four-second reference release, listen/response separation, neutral/low/high warm-up meters, octave-finder readouts, highway pitch/duration geometry, approximate lyric bounds, measured trace resets and view switching. Module syntax, standalone export, responsive layouts and generated microphone audio are checked; physical phone singing remains a user trial.

## 0.16.0 — October 23, 2026 — Warm-up and arcade highways

- Vocal settings include opening-melody echo exercises, explicit major/minor key scales, octave shifts and a steady-voice octave suggestion that can set reference-guide sound. Listen/sing turns keep the reference tone out of pitch matching. Feedback remains local, opt-in and ungraded.
- All solo/band note highways have a reserved side meter: live judged accuracy and streak for drums/keyboard, clearly unscored progress for guitar/bass, listen mode and teacher guides.
- Classic/Arcade highway styles share timing/scoring. Arcade adds neon runways, glowing notes and real-hit bursts. Effects can be switched off and respect reduced motion. Concert-background media remains a future idea, as requested.
- Validation: 157 tests pass, including warm-up intervals/evidence/cancellation, reference-turn separation, live-meter semantics, unscored modes and bounded non-mutating canvas effects. Browser syntax, standalone and responsive/generated-audio QA are checked. Existing school data/volume/revisions are retained.

## 0.15.0 — October 22, 2026 — Phone singing practice

- A focused phone singing screen combines large karaoke lyrics, Target / You note names, a pitch meter, and large Play/Pause/Continue controls. Retry a lyric line, seek or skip to the next entrance with a lead-in. Phone playback opens the focus view; sound settings and the staff/reference tones are collapsible. Teacher-led jam playback retains teacher control.
- Optional microphone pitch feedback runs entirely in the browser. Students explicitly enable/disable it; audio is never recorded, uploaded or saved as a grade. Feedback distinguishes high/low/on-pitch, allows a comfortable or exact octave, and stays neutral for rests, uncertain input and overlapping target notes. Includes adjustable input-delay correction, permission recovery and cleanup on song/account/view changes, page hiding, device/audio interruptions and song completion.
- Slow school song-list refreshes retain the song currently being practiced. The original Full band warm-up includes a vocal melody to try the feature. Existing school music, lyric timings, song revisions, accounts and storage are retained. No schema or Railway variable changes.
- Validation: 149 automated tests pass, including generated vocal fundamentals/harmonics/noise at 44.1/48 kHz, permission cancellation/denial/retry, microphone cleanup, pause/continue and backing-offset seeks. Browser QA checks responsive layouts and generated microphone audio. Physical iPhone/Android microphone accuracy and latency still need student testing. See [the singing practice guide](docs/SINGING_PRACTICE.md).

## 0.14.1 — October 22, 2026 — Karaoke display trial

- Vocal lyrics start white and progressively fill yellow in reading order, including wrapped lines. The next line stays white. The sweep uses the saved line start/end and text-length weighting; exact word/syllable timestamps are not yet stored or inferred from the vocal melody.
- Long instrumental gaps show a countdown. The upcoming line and following line appear two musical bars before the entrance, using the chart's measure/beat grid across tempo and meter changes. The staff/target guide and existing song timing remain in place.
- No microphone capture or vocal grading is added. This is a display iteration for teacher feedback; school song metadata, recordings and assignments do not need to be republished.
- Validation: 140 tests, browser syntax and standalone export pass. New timing tests cover a two-bar preview across tempo/meter changes, instrumental gaps, restarts and wrapped-word progression; local browser playback verifies white opening text and the yellow sweep with the retained vocal staff.

## 0.14.0 — October 22, 2026 — Prototype 14

- Prominent End session controls inside teacher rooms and beside existing invitations. Teachers can change songs, reassign the same students' parts and start from a chosen source bar without creating a new room. Applying a change interrupts an active take, retains the connected seats and requires fresh readiness/count-in. Ended rooms cannot be restarted.
- Shared section timelines keep tempo changes, original bar numbers, backing recording slices and lyric cues aligned. Saved section results count only that section and do not qualify as complete-song runs. Completed and interrupted earlier takes remain intact.
- Solo and jam drums now share the same perspective highway renderer. Closed and open hi-hats use separate labelled boxes; open notes are hollow. MIDI open notes 46/26 (or explicit open articulation) identify the display lane. Pad mappings and the common hi-hat timing judge retain their existing meaning.
- Plain lyric text can be loaded and timed against the retained recording. Mark line starts, end lines before instrumental gaps, undo marks and apply a timed vocal part before publishing. No external lyric lookup is built into the app. Supplied school lyrics and recordings are not included in the repository.
- Selected lead-vocal MIDI tracks now supply a scrolling treble-staff melody guide, current pitch/octave, held-note tails and an optional local guide tone alongside lyrics. Vocal participation remains unscored. Text-only vocal parts remain supported; the guide does not infer word-to-note alignment or transpose the singer silently.
- Validation: 137 automated tests, module syntax and standalone export pass. Browser checks cover room reuse/song changes/start bars/end, separate hi-hat targets and line-timing preparation using synthetic accounts and original music. Physical instrument and multi-computer audible timing validation remain classroom checks. No schema or hosting-variable changes.

## 0.13.0 — October 22, 2026 — Prototype 13

- Collapsible left instrument menu; per-account default instrument in student creation, roster editing and account preferences; student sign-in opens practice. Remove redundant standalone drum-pad panel and start the practice journal collapsed.
- Click a journal/accuracy result to reopen a note report. New drum/keyboard attempts retain detailed notes privately across computers. Stopped attempts report only the reached section, exclude future notes and remain distinct from completed full-song attempts. Existing summaries remain available.
- Zoom and pan the timing chart, drag/select source bars and add them to a four-pass individual loop. Note tables, CSV, replay, slower built-in retry and next-track controls remain. Drum and pitched section playback retain shared audio alignment; interrupted jam attempts do not claim shared completion.
- Adjustable drum highway lane order, with hi-hat on the far left by default; device-local ordering covers solo and jam views without changing notation or input mappings.
- Full wrapping guitar/bass tablature with moving play bar, row following and fullscreen transport. Rendering uses a bounded viewport canvas.
- Validation: **128 tests pass**, syntax and standalone export pass. Browser QA verifies defaults, journal/report reopening, partial drum/keyboard reports, a scored computer-key hit, zoom/drag selection and applied practice loops, retained lane order/reset and full tablature. Private reports and defaults use existing persistent school storage; no schema or Railway setting changes. See [STUDENT_WORKFLOW.md](docs/STUDENT_WORKFLOW.md).

## 0.12.0 — October 22, 2026 — Prototype 12

- Guitar and bass follow-along parts with a string/fret highway, moving-cursor tab, fullscreen and Play/Stop. Suggested standard-tuning positions preserve MIDI pitch, use separate strings for simultaneous notes and flag notes that cannot be placed. No guitar/bass input or grading is required.
- Vocals show current/next lyric lines and line progress. Read embedded MIDI lyric events with limited karaoke text fallback, or import/edit LRC, basic WebVTT or SRT. MIDI/recording timestamp clocks and a separate lyric adjustment retain shared audio alignment. Words are supplied by the teacher; no microphone, vocal grading or automatic commercial-lyric fetching.
- School arrangements and the library support drums, keyboard, guitar, bass and vocals. Edit instrument parts retains existing MIDI, backing, timing, drum mapping and song identity while publishing a new revision. An original five-part Full band warm-up is included.
- Teacher sessions allow 1–8 distinct students with per-student part assignments. Guitar/bass/vocals follow the shared start and save unscored participation; drum/keyboard scoring remains separate. No schema, volume or Railway variable changes.
- Validation: **120 tests pass**, module syntax and standalone export pass. Tests cover five-student transport/completion/persistence, score separation, lyrics and tempo/backing clocks, lyric-only publication, track detection, fret/chord/range handling and drawing geometry. Browser QA with isolated synthetic accounts and original MIDI verifies tab playback, displayed lyrics, five assigned seats and retained instrument/lyric settings. Real instruments, the named Dreams file and multi-computer audible synchronization still need the classroom trial. See [the usage and research guide](docs/GUITAR_BASS_VOCALS.md).


## 0.11.2 — October 22, 2026 — Prototype 11.2

- Teachers can choose a student password on account creation or use Set password on an existing roster entry. Teacher-chosen student passwords work immediately for practice and jam sessions without a forced first-login change. Leaving the create-password field blank retains the generated temporary-password option.
- Student passwords accept 4–128 characters; staff passwords accept 8–128, without composition rules. Browser and server share the role-specific minimum. Existing passwords continue working.
- Password changes preserve usernames/results and revoke existing student sessions. Roster ownership checks, salted password hashes, CSRF protection and sign-in rate limits remain. Chosen passwords are not echoed by the API or stored in plain text; the teacher can copy their submitted login details for the current visit. No schema or Railway variable changes.
- Validation: **113 tests pass**, module syntax and standalone export pass. Tests cover teacher/owner permissions, short-password validation and sign-in, generated-password compatibility, jam assignment without a first-login change, session revocation, password changes across restart, retained results and browser-client form/credential behavior. The live browser preview check was blocked by the browser URL policy; no real account passwords were changed.

## 0.11.1 — October 22, 2026 — Prototype 11.1

- Detect piano/keyboard track and instrument names plus explicit General MIDI piano programs, including program changes on another track of the same channel. Leave ambiguous guitar/bass/unidentified tracks unassigned; explicit instrument assignments win.
- Older school songs without part metadata expose their detected piano alongside their saved drums in the library, keyboard practice and teacher session catalog. Detection reads the retained MIDI without replacing files, changing song/revision identity or rewriting existing records. New publications store the detected instrument parts.
- Practice keyboard opens the actual piano part. Publishing teachers/owners can Edit instrument parts using the existing MIDI, backing, offset, speed, volume and drum map, then publish a revision of the same song. Existing files and practice results remain.
- Validation: **110 tests pass**, syntax and standalone export pass. Coverage includes older-library detection, program/channel timing, explicit assignments, end-to-end imported-song two-student start/results, song revisions and backing preservation, and library action routing. Browser QA verifies detected piano practice, retained settings, revision publication and separate drum/piano session seats with isolated synthetic accounts and original music. The exact Dreams MIDI and physical instruments have not been verified locally.

## 0.11.0 — October 21, 2026 — Prototype 11

- Solo MIDI keyboard practice: selected input/channel, held-key feedback, configurable computer keys and octave, optional synthesized tones, keyboard note highway/fullscreen, pitch/onset timing judge, wrong-note feedback, per-note report and CSV. Releases and computer repeat suppression are distinct from drum input.
- Three original drum-and-keyboard duets and versioned published arrangements with explicit track/channel assignments, shared tempo/meter/backing alignment and portable setup JSON. Existing drum songs still work; the drum editor retains keyboard parts when updating mixed arrangements. Keyboard staff/chord/hold/pedal grading remains future work.
- Teacher-owned rooms invite two existing students and assign their parts. Audio/input readiness and clock measurements precede a future shared count-in. Teacher Start, Stop/prepare-next-take and Close controls; each performer is graded locally from native timestamps.
- Live teacher performer cards, individual school histories and recent grouped takes. Completed results save idempotently. Lost input, hidden tabs, expired sessions, duplicated tabs, stale commands and server restarts have explicit interrupted/rejoin states.
- Additive schema-2 migration for take/result tables after the existing recovery-copy check. School identity, accounts, published music and legacy results are retained. Active rooms are temporary; completed and interrupted take records persist. Server requires the pinned MIT-licensed ws dependency via npm ci; browser/standalone have no downloaded runtime package.
- Validation: **105 tests pass**, module syntax and standalone export checks pass. Browser QA uses synthetic accounts/original music: teacher starts two simulated performers, then a keyboard student browser follows a simulated teacher/drummer and saves a shared report. Verified key remapping across refresh, fullscreen/Escape continuity, MIDI publication and drum notation. Real TD-17/keyboard drivers, three-computer audible synchronization, school Wi-Fi and the hosted post-deploy round trip still require the classroom trial in [BAND_TESTING.md](docs/BAND_TESTING.md). Production accounts and music were not used in QA.

## 0.10.0 — October 20, 2026 — Prototype 10

- Fullscreen for **Note highway**, **Sheet music** and **Full sheet**. The embedded Play/Stop/Listen toolbar adds a View selector; switching preserves the run and keyboard/MIDI timing. Sheet legends remain inside fullscreen. Escape returns to the page without stopping playback.
- School storage is checked before opening a writable database: the configured path must be inside Railway's attached volume, school identity must match its marker/optional environment pin, and SQLite integrity/schema checks must pass. An absent/ownerless production database needs an explicit new-school initialization flag; existing schools retain their owner/data.
- Consistent private database recovery copy before each new app version, retaining the original copy across restarts. Copies omit active sessions/drafts, stay on the same volume and do not copy music. Independent backups remain necessary. Bad storage pauses school APIs and clearly explains the problem while individual practice remains available.
- Owner-only school storage/recovery panel, revised Railway setup and recovery guide, conversation record, discussion/handoff updates and a scoped shared jam-session plan. A teacher-led two-drummer session is the proposed next milestone, not a feature in this release.
- Validation: **88 tests pass**, module syntax and standalone export pass. Coverage includes three published demo songs/two accounts across updates, recovery-copy consistency, bad mounts, replacement/missing/corrupt databases, school identity and future-schema rejection, API permissions and safe write blocking. Browser QA covers fullscreen views/transport, live switching, scored keyboard input, Escape and owner storage diagnostics using synthetic data. Actual hardware input, hosted backup schedules and recovery of the old volume remain unverified.

## 0.9.0 — October 20, 2026 — Prototype 09

- USB MIDI drumkit input in supported secure browsers, with an explicit Connect drumkit action, permission guidance, input picker and live pad/note/strength readout. Default mappings include common drum notes and Roland hi-hat variants; Learn pad adds rims/edges or moves a note to a different drum. Individual notes can be ignored and defaults restored.
- Local device/mapping/sound preferences are separate from keyboard and song-import controls. App drum sounds for kit hits default off for use with the module's sounds. Keyboard/on-screen controls and every practice view continue using the same timestamped judge; MIDI velocity affects optional app sound volume, not grading.
- Selected-device disconnect stops the run; reconnect restores that device without substituting other MIDI inputs. Cancelled permission/open requests cannot reopen a disconnected input. MIDI releases, clock, controllers and choke messages do not create false strikes. No MIDI output or SysEx access.
- TD-17 setup/troubleshooting guide and updated development handoff/discussion log. Physical pad/latency and Chrome permission validation remain for the user's Windows/TD-17 test; the in-app browser keeps MIDI permission pending, with a usable Disconnect cancellation.
- Validation: **80 automated tests pass**, module syntax and standalone export checks pass. Browser checks cover the connection panel, cancellation, mapping controls/preferences, keyboard practice and panel layout. MIDI hardware tests use simulated ports; no physical-kit verification is claimed.

## 0.8.1 — October 20, 2026 — Prototype 08.1

- Full-screen icon for **Full sheet**, with a compact **Play/Stop**, **Listen first**, song title and exit toolbar. The score uses the available screen width/height and tighter row spacing. Browsers that deny native fullscreen still maximize within the page viewport.
- Keyboard scoring and the existing audio clock continue through entry/exit. Escape leaves full screen; stopping and starting use the existing transport. Completed scored runs leave full screen before opening the report.
- Keyboard focus stays within the expanded score, exit restores the page, and fullscreen requests that finish after cancellation cannot reopen it.
- Validation: **69 automated tests pass**, module syntax and standalone export pass. Browser checks cover fullscreen entry/exit, transport, a scored keyboard hit, report display and responsive layout using original exercises/demo music.

## 0.8.0 — October 20, 2026 — Prototype 08

- Third practice view: **Full sheet** wraps the entire score into rows, with a moving gold play bar and automatic row following during playback. Built-in/imported songs, loops, focus, tempo changes, meters and keyboard scoring share the existing timing model. Long scores draw only visible rows on a viewport-sized canvas.
- Device and school library songs open directly into practice with saved mappings, backing audio and sync settings. Teachers/guests can open **Edit song setup** separately.
- Live backing-volume slider beside the loaded song; volume changes apply to current/scheduled backing slices without restarting the song or changing synthesized drums.
- Removed the **Find your pocket** intro banner, moved practice directly below the header, and let the full-sheet view use the page width. Short scores use less vertical space.
- Validation: **63 automated tests pass**, syntax check and standalone export pass. Browser checks cover wrapped built-in/imported scores, keyboard scoring after live view switches, direct saved-song loading, live volume changes, reopening detailed setup and a 390-pixel layout. Original demo files only; the user's Dreams MIDI/recording and TD-17 hardware were unavailable.

## 0.7.0 — October 19, 2026 — Prototype 07

- School owner and teacher accounts; teachers create student usernames without email and see their own students' practice results. The owner can create teachers and assign new students to them.
- Temporary passwords with required first-sign-in change, password reset and disable/re-enable controls; permission checks, private sessions, CSRF protection and password hashing on the server.
- One shared school library containing MIDI, optional backing audio, drum mappings and alignment. Teachers can publish existing device songs and update their own school songs; students practice published versions in both views with keyboard controls.
- Completed account runs persist with hits/misses/extras, streak, tempo, section/repeats/focus, early/late tendency and drum timing summaries. Results retry after a failed save; account switching clears the previous account's screen and report. Guest history remains separate.
- Private SQLite/music storage on one persistent Railway volume, bounded authenticated uploads, atomic publication, archived songs, consistent backup and administrator owner recovery tools. Production does not enable accounts without a configured data directory.
- Railway activation guide, updated discussion log and development handoff. Actual hosted activation still needs the volume and variables in `docs/CLASSROOMS.md`; no real accounts or student data were created during development.
- Validation: **56 tests pass**, syntax check and standalone export pass. Isolated browser checks cover owner/student login, temporary password flow, teacher publishing, student song playback and completed result saving, reload persistence, guest/account switching, teacher reports, device-to-school publishing and narrow-screen layout. Synthetic accounts and original demo music only; TD-17 hardware remains untested.

## 0.6.1 — October 16, 2026 — Prototype 06.1

- Colored MIDI drum-hit overlays on the audio waveform, with separate rows and a legend for simultaneous drums.
- Click a drum-row marker to select its MIDI bar/beat, then click the corresponding audio attack and apply the beat match. A readout names the selected drums and their current recording timestamp.
- Markers follow offset, MIDI speed, zoom, and drum mappings on a shared recording-time axis. The overlay can be hidden to inspect audio alone.
- Validation: **51 tests pass**, syntax check and standalone export pass. Browser checks cover marker selection, audio matching, nudges, overlay toggle, and responsive layout.

## 0.6.0 — October 16, 2026 — Prototype 06

- Local backing-audio analysis with up to three reviewable MIDI alignment candidates; offset and optional small duration-ratio search.
- Waveform, recording-only and combined eight-second previews, bar/beat-to-recording matching, optional second match for steady drift, and 50 ms nudges.
- MIDI speed adjustment (50–200%) without changing backing audio pitch/speed. Internal tempo changes, count-in, loop slices and grading remain aligned.
- Imported MIDI sheet music with the shared scrolling playhead, drum/key legend, rests, tuplets, 32nds, changing meter, partial measures, loops and focus. Exact MIDI times remain unchanged by notation display rounding.
- Local song library and per-song preferences retain MIDI speed alongside offset/mappings/volume; older saved entries default to 100%.
- Download/load portable song setup JSON, with exact MIDI fingerprint validation. Audio/MIDI files travel separately.
- Added development handoff, discussion/decision log, next-milestone plan and updated README.
- Validation: **50 automated tests pass**, plus module syntax check and standalone export. Browser checks with original sample files covered suggestions, manual start/drift matching, previews, saved alignment after reload, setup JSON download/restore, MIDI-only speed changes, focused loops, live view switching, keyboard strikes and the completed report. Actual user song recordings and TD-17 hardware remain to be tested.

## 0.5.0 — October 15, 2026 — Prototype 05

- 24 original exercises across four difficulty levels.
- Selected-bar practice loops, one/two/four/eight passes, drum focus and built-in tempo ladder.
- Per-pass reports, slower retry, next-track action, local journal and source-bar/pass CSV columns.
- Expanded drum notation for toms, cymbals, rests and sixteenths.
- Commit: `c312294bc252f77e901c7e43ae1d58193ac782bb`.

## Earlier prototypes

- Browser keyboard drum practice, configurable key mappings and synthesized sounds.
- GM MIDI import, drum mapping, backing audio, original samples, browser song library and Railway-ready serving.
- Built-in sheet/highway toggle, moving playhead, hit boxes and grouped strike cues.
