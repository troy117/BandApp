# Student practice and reports — Prototype 13

October 22, 2026. This release reorganizes practice and adds detailed, reusable reports.

## Student screen

- Instruments live in the left menu. Use the menu icon to collapse or expand it. It starts compact on smaller screens.
- Teachers choose a Default instrument while adding a student or change it in the classroom roster. Students can also choose their default under their school account. This is stored with the school account and applied after sign-in or refresh on another computer; changing instruments during a visit does not overwrite the default.
- Students land on their default instrument after sign-in. The separate drum-pad/keyboard-is-the-kit panel is removed. Key labels remain by the highway; Controls still provides keyboard remapping, timing settings and USB drumkit configuration.
- Your practice journal starts closed. Click its heading to expand it, then click a result row to reopen the report. Teacher/student account result lists also have a Report button on each accuracy result.

Prototype 29 adds a compact drum report with the timing graph first, **Retry** beside **Exit**, and separate closed/open/pedal hi-hat targets. See [current report and hi-hat behavior](DRUM_REPORTS_AND_HIHAT.md). Retry returns the current solo setup to fullscreen, waiting for Play; historical Play again keeps its existing behavior.

## Reports for completed and stopped songs

New scored drum and keyboard attempts save note-level detail. Stopping through Stop/Escape opens a report of the notes reached before the stop. Future notes do not become misses. A reached note with an unfinished timing window is closed when the attempt is stopped. Notes already played slightly early remain included. Count-ins and listen-only playback do not create scored attempts. Stopping during an intro before any expected notes shows a local empty report without adding a zero-note saved attempt. Keyboard/drum input loss or an interrupted shared take can retain a partial individual report without claiming that the shared take completed.

The report shows match rate, notes matched, misses, wrong notes, extra hits and average timing error. Its table lists each expected note and whether it matched, missed or was the wrong pitch, including early/late milliseconds when applicable. Extra notes are also shown and included in CSV. Summary accuracy uses attempted expected notes plus extras; timing averages use matched notes only. Stopped attempts are labeled and cannot qualify as a best full-song run.

Signed-in reports use the existing private school storage. Detailed note data is stored separately from the history list so opening a journal does not download every note from every attempt. Students can read only their own reports; teachers can read their roster's reports. Report identifiers remain idempotent. Original song revisions remain available for practicing the exact version used by a report, subject to the existing library visibility rules.

Older attempts retain the summaries that were saved originally. Their per-note detail cannot be recreated. Guest history is limited to the current browser and a bounded amount of detailed storage; old detail may be reduced to a summary when that limit is reached. The current report and CSV remain available for the visit. School accounts retain server reports across computers.

## Zoom, highlight and practice

1. Open a report from the journal or immediately after an attempt.
2. Use + / − to zoom. Timeline position moves through the attempt; Whole attempt resets the zoom. Zoom centers on selected source bars when available.
3. Drag across the chart to select bars, click a source-bar number in the note table, or enter From bar / Through bar. Selection uses original song bars even when the attempt repeats a section.
4. Choose Add section to practice. The app loads the matching provided/school song version and prepares four passes of those bars. Press Start/Play when ready. Change the section and pass count in Practice your way or Practice a section.

A local personal MIDI must still be loaded on that computer. Leave an active jam room before preparing individual section practice; the report does not change the teacher's shared transport. Play again retains the attempt's section/pass count. Built-in drum reports also retain Try 5 BPM slower and Explore next track.

## Drum highway lanes

Hi-hat is now the far-left default lane. Open Controls → Drum lane order to move any drum or cymbal left/right, or restore defaults. The order saves on that computer and applies to individual and jam drum highways. Drum notation positions, keyboard bindings and USB pad mappings keep their existing meanings.

## Full guitar and bass sheets

Select Full sheet · tablature in View. The entire part wraps into rows with string names, suggested fret numbers, bar labels, durations and a moving gold play bar. Scroll to inspect any row; playback follows the active row. The existing fullscreen icon and Play/Stop toolbar work with this view. Only visible rows are drawn, so a long score does not allocate one enormous canvas. Standard tuning and the existing suggested-fingering limitations remain; this is tablature, not recovered original engraving or a new assessment mode.

## Validation and deployment

128 automated tests, module syntax and standalone export pass. Tests include partial drum/keyboard scoring, wrong notes, source-bar selection across repeated sections, backing segments, private report access, large note reports, idempotent storage and reopening, default-instrument permissions/persistence, original revision retrieval, shared-take detail attachment, lane orders and full-tab wrapping.

Browser checks use isolated synthetic accounts and original music: student default selection, left menu, closed journal, reports reopened after refresh, keyboard/drum input, manual stop without future misses, zoom and actual drag selection, section application, saved lane reordering/reset, and guitar/bass full sheets. Physical instruments and multi-computer audible synchronization remain classroom checks.

No new dependency, database schema, Railway variable or volume is required. Keep the current persistent data folder and volume. The app version is 0.13.0 / Prototype 13. Conversation and handoff notes are included with the source.
